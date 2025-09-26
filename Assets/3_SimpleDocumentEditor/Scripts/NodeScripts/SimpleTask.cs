using System;
using System.Collections.Generic;
using System.Linq;
using RuntimeNodeEditor;
using TMPro;
using UnityEngine;

public class SimpleTask: Node
{
    [Header("UI")]
    public TMP_Text statusText;                 // optional status/preview
    public TMP_Dropdown dropdown;
    

    [Header("Sockets")]
    public SocketInput  inputSocket;            // expects string
    public SocketOutput outputSocket;           // emits string

    // Track a single upstream source (latest connected wins)
    private IOutput _upstream;

   
    
    public override void Setup()
    {
        Register(outputSocket);
        Register(inputSocket);

        SetHeader($"Simple Task");
        outputSocket.SetValue(string.Empty);
        statusText?.SetText("idle");

        OnConnectionEvent += OnConnected;
        OnDisconnectEvent += OnDisconnected;
        

        var options = new List<TMP_Dropdown.OptionData>();

        foreach (var kv in TextTaskPrompts.Prompts)
        {
            options.Add(new TMP_Dropdown.OptionData(kv.Key));
        }
        dropdown.AddOptions(options);
        
        dropdown.onValueChanged.AddListener(selected => {
            RequestSummary();
            SetHeader($"ST:{dropdown.options[selected].text}");
        });
        
    }

    

    public override void OnSerialize(Serializer s)
    {
        s.Add("instr", dropdown.value.ToString());
    }

    public override void OnDeserialize(Serializer s)
    {
        var instr = s.Get("instr");
        dropdown.value =  int.Parse(instr);
       // RequestSummary(); //ToDo: design choice
    }

    private void OnConnected(SocketInput input, IOutput output)
    {
        // Prefer the most recent connection as the source
        if (_upstream != null) _upstream.ValueUpdated -= RequestSummary;
        _upstream = output;
        _upstream.ValueUpdated += RequestSummary;
        RequestSummary();
    }

    private void OnDisconnected(SocketInput input, IOutput output)
    {
        if (_upstream == output)
        {
            _upstream.ValueUpdated -= RequestSummary;
            _upstream = null;
            outputSocket.SetValue(string.Empty);
            statusText?.SetText("idle");
        }
    }

    // ---- Core: simple enqueue → update on callback ----
    private void RequestSummary()
    {
        string inputText = _upstream?.GetValue<string>() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(inputText))
        {
            outputSocket.SetValue(string.Empty);
            statusText?.SetText("idle");
            return;
        }

        if (LlmQueue.Instance == null)
        {
            statusText?.SetText("error: LlmQueue missing");
            return;
        }

        string sys = TextTaskPrompts.Prompts.GetValueOrDefault(
            dropdown?.options?.ElementAtOrDefault(dropdown.value)?.text ?? string.Empty,
            "Process this short paragraph as requested in a concise way."
        );
        
        statusText?.SetText("queued…");
        Debug.Log($"Queue-Ing with {sys}");
        _ = LlmQueue.Instance.Enqueue(
            userContent: inputText,
            systemPrompt: sys,
            responseFormat: null,
            onSuccess: summary =>
            {
                // NOTE: minimal version — accepts last callback even if upstream changed.
                outputSocket.SetValue(summary ?? string.Empty);
                statusText?.SetText(DocNodeEditorUtil.Preview(summary));
            },
            onError: ex =>
            {
                Debug.LogError(ex);
                outputSocket.SetValue(string.Empty);
                statusText?.SetText($"error: {ex.Message}");
            }
        );
    }

   
}



public static class TextTaskPrompts
{
    public static readonly Dictionary<string, string> Prompts =
        new Dictionary<string, string>
        {
            { "Summarize",
                "Summarize this short paragraph in 1–2 concise sentences. Output LaTeX-safe prose." },

            { "Explain",
                "Explain the paragraph clearly, as if teaching a student. Keep it short and simple." },

            { "Consistency",
                "Check this short paragraph for internal consistency or contradictions. Give a brief note." },

            { "Simplify",
                "Rephrase the paragraph in simpler words while keeping meaning intact. Length similar." },

            { "Elaborate",
                "Expand this short paragraph into a slightly longer explanation with more detail." },

            { "Critique",
                "Provide quick feedback on clarity and coherence. Suggest one or two improvements." },

            { "Questions",
                "Write 2–3 short questions a reader might ask after reading this paragraph." },

            { "Translate",
                "Translate this short paragraph into English. Keep meaning accurate." },
            
            { "ToneShift",
                "Rewrite the paragraph in a more formal academic tone." },

            { "Counter",
                "Suggest one possible counter-argument to the claim in the paragraph." }
            
        };
}