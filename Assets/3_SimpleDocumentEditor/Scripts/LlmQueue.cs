using System;
using System.Collections.Concurrent;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public sealed class LlmQueue : MonoBehaviour {
   public static LlmQueue Instance { get; private set; }

   [Header("Endpoint")] [SerializeField] string baseUrl = "http://localhost:1234/v1"; // LM Studio default
   [SerializeField] string apiKey = "lm-studio"; // LM Studio token
   [SerializeField] string model = "deepseek/deepseek-r1-0528-qwen3-8b";
   [SerializeField, Range(0f, 1f)] float temperature = 0.2f;

   readonly ConcurrentQueue<LlmJob> _q = new();
   readonly SemaphoreSlim _gate = new(1, 1);
   HttpClient _http;
   CancellationTokenSource _cts;
   bool _running;
   private Task _task;

   void Awake() {
      if (Instance != null && Instance != this) {
         Destroy(gameObject);
         return;
      }

      Instance = this;
      DontDestroyOnLoad(gameObject);

      _http = new HttpClient();
      _http.Timeout = TimeSpan.FromSeconds(120);
      _cts = new CancellationTokenSource();
      _running = true;
      _task = Worker(_cts.Token);
   }

   void OnDestroy() {
      _running = false;

      _cts?.Cancel();
      _http?.Dispose();
      _gate?.Dispose();
//      _task?.Dispose();
   }

   public Task<string> Enqueue(
      string userContent,
      string systemPrompt,
      Newtonsoft.Json.Linq.JToken responseFormat = null,
      string overrideModel = null,
      float? overrideTemp = null,
      Action<string> onSuccess = null,
      Action<Exception> onError = null) {
      var tcs = new TaskCompletionSource<string>();
      _q.Enqueue(new LlmJob {
         user = userContent,
         sys = systemPrompt,
         responseFormat = responseFormat,
         model = overrideModel ?? model,
         temp = overrideTemp ?? temperature,
         done = s => {
            onSuccess?.Invoke(s);
            tcs.TrySetResult(s);
         },
         fail = e => {
            onError?.Invoke(e);
            tcs.TrySetException(e);
         }
      });
      return tcs.Task;
   }

   async Task Worker(CancellationToken token) {
      while (_running && !token.IsCancellationRequested) {
         if (!_q.TryDequeue(out var job)) {
            await Task.Delay(10, token);
            continue;
         }

         var url = $"{baseUrl.TrimEnd('/')}/chat/completions";
         var body = new Newtonsoft.Json.Linq.JObject {
            ["model"] = job.model,
            ["temperature"] = job.temp,
            ["messages"] = new Newtonsoft.Json.Linq.JArray {
               new JObject { ["role"]="system", ["content"]= job.sys },
               new JObject { ["role"]="user",   ["content"]= job.user }
            }
         };
         if (job.responseFormat != null)
            body["response_format"] = job.responseFormat;  // 👈 stays as object

         var json = body.ToString(Newtonsoft.Json.Formatting.None);

         await _gate.WaitAsync(token);
         try {
            const int maxRetries = 3;
            var delayMs = 300;

            for (int attempt = 0; attempt < maxRetries; attempt++) {
               try {
                  // IMPORTANT: new request + content per attempt
                  using (var req = new HttpRequestMessage(HttpMethod.Post, url))
                  using (var content = new StringContent(json, Encoding.UTF8, "application/json")) {
                     req.Headers.TryAddWithoutValidation("Authorization", $"Bearer {apiKey}");
                     req.Content = content;

                     using var resp = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, token);
                     var payload = await resp.Content.ReadAsStringAsync(); // no token overload in Unity

                     if (!resp.IsSuccessStatusCode)
                        throw new HttpRequestException($"HTTP {(int)resp.StatusCode}: {payload}");

                     var root = JObject.Parse(payload);
                     var message = root["choices"]?[0]?["message"]?["content"]?.ToString();

                     job.done?.Invoke(message ?? "");
                     break; // success -> exit retry loop
                  }
               }
               catch (Exception ex) when (attempt < maxRetries - 1) {
                  await Task.Delay(delayMs, token);
                  delayMs *= 2;
                  Debug.LogException(ex);
                  continue;
               }
               catch (Exception ex) {
                  job.fail?.Invoke(ex);
               }
            }
         }
         finally {
            _gate.Release();
         }
      }
   }

   struct LlmJob {
      public string user, sys, model;
      public Newtonsoft.Json.Linq.JToken responseFormat;
      public float temp;
      public Action<string> done;
      public Action<Exception> fail;
   }
}