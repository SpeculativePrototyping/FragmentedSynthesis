using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using RuntimeNodeEditor;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

public class ExtractPoints: Node {
   [Header("UI")] public TMP_Text statusText; // optional status/preview
   public TMP_InputField NumberOfPoints;


   [Header("Sockets")] public SocketInput inputSocket; // expects string
   public List<SocketOutput> outputSocket; // emits string
   public GameObject OutputSocketPrefab;

   public GameObject OutputSocketVerticalLayoutGroup;

   // Track a single upstream source (latest connected wins)
   private IOutput _upstream;

private int LastNumberOfPoint=0;
   public override void Setup() {
      // Register(outputSocket);
      Register(inputSocket);

      SetHeader($"Extract Key Points");
      outputSocket = new List<SocketOutput>();
      statusText?.SetText("idle");

      OnConnectionEvent += OnConnected;
      OnDisconnectEvent += OnDisconnected;


      if (string.IsNullOrWhiteSpace(NumberOfPoints.text)) // ✅ default
         NumberOfPoints.text = "3";

      HandleFieldValue(NumberOfPoints.text);              // ✅ create sockets
      NumberOfPoints.onEndEdit.AddListener(HandleFieldValue);
   }

   private void HandleFieldValue(string value) {
      if (!int.TryParse(value, out var val) || val < 1) val = 1;   // ✅ validate
      LastNumberOfPoint = val;                                     // ✅ keep in sync

      int diff = val - outputSocket.Count;
      for (int i = 0; i < Mathf.Abs(diff); i++) {
         if (diff > 0) {
            GameObject newSocket = Instantiate(OutputSocketPrefab);
            newSocket.transform.SetParent(OutputSocketVerticalLayoutGroup.transform,false);
            outputSocket.Add(newSocket.GetComponent<SocketOutput>());
            Register(newSocket.GetComponent<SocketOutput>());
            LayoutRebuilder.ForceRebuildLayoutImmediate(OutputSocketVerticalLayoutGroup.GetComponent<RectTransform>());
         }
         else if (diff < 0) {
            var tmp = outputSocket.Last();
            DeRegister(tmp);
            outputSocket.Remove(tmp);
            Destroy(tmp.gameObject);
         }
      }
   }

   public override void OnSerialize(Serializer s) {
      s.Add("instr", NumberOfPoints.text);
   }

   public override void OnDeserialize(Serializer s) {
      var instr = s.Get("instr");
      if (string.IsNullOrWhiteSpace(instr)) instr = "3";      // ✅ default
      NumberOfPoints.SetTextWithoutNotify(instr);
      HandleFieldValue(instr);                                // ✅ rebuild sockets
   }

   private void OnConnected(SocketInput input, IOutput output) {
      // Prefer the most recent connection as the source
      if (_upstream != null) _upstream.ValueUpdated -= RequestPointExtraction;
      _upstream = output;
      _upstream.ValueUpdated += RequestPointExtraction;
      RequestPointExtraction();
   }

   private void OnDisconnected(SocketInput input, IOutput output) {
      if (_upstream == output) {
         _upstream.ValueUpdated -= RequestPointExtraction;
         _upstream = null;
         outputSocket.ForEach(f =>f.SetValue(String.Empty)); 
         statusText?.SetText("idle");
      }
   }

   // ---- Core: simple enqueue → update on callback ----
   private void RequestPointExtraction() {
      string inputText = _upstream?.GetValue<string>() ?? string.Empty;
      if (string.IsNullOrWhiteSpace(inputText)) {
         outputSocket.ForEach(f =>f.SetValue(String.Empty));
         statusText?.SetText("idle");
         return;
      }

      if (LlmQueue.Instance == null) {
         statusText?.SetText("error: LlmQueue missing");
         return;
      }
      if (LastNumberOfPoint < 1) LastNumberOfPoint = Mathf.Max(1, outputSocket.Count); // ✅


      var schema = JsonSchemas.BuildKeyPointsSchema(n: LastNumberOfPoint, exactCount: true);
      
      string flavor = String.Empty;// = "Focus on methods and study design."; // from your focus-injector node

      string sys =
         $"Identify the {LastNumberOfPoint} most important points in this short paragraph. Respond only in supplied JSON format.";
      
      string userContent = $"{inputText}\nReturn only JSON per schema.";

      

      statusText?.SetText("queued…");
      Debug.Log($"Queue-Ing with {sys} {schema}");
      _ = LlmQueue.Instance.Enqueue(
         userContent: userContent,
         systemPrompt: sys,
         responseFormat: schema,
         onSuccess: summary => {
            // NOTE: minimal version — accepts last callback even if upstream changed.
            Debug.Log(summary);
            var parsed = JObject.Parse(summary);
            var points = parsed.Properties()
               
               .Where(p => p.Name.StartsWith("point"))
               .OrderBy(p => int.Parse(new string(p.Name.Where(char.IsDigit).ToArray())))
               .Select(p => p.Value.ToString())
               .ToList();
            
            for (int i = 0; i < Mathf.Min(outputSocket.Count, points.Count); i++) {
               outputSocket[i].SetValue(points[i]);
            }

            statusText?.SetText(DocNodeEditorUtil.Preview(summary));
         },
         onError: ex => {
            Debug.LogError(ex);
            outputSocket.ForEach(f =>f.SetValue(String.Empty));
            statusText?.SetText($"error: {ex.Message}");
         }
      );
   }

   
}

public static class DocNodeEditorUtil {
   
   public static string Preview(string s) {
      if (string.IsNullOrEmpty(s)) return "done (empty)";
      s=s.Replace("\r", "")
         .Replace("\n", "")
         .Replace("\t", "");
      const int max = 25;
      return s.Length <= max ? s : s.Substring(0, max) + "…";
      
      
   }
   
}