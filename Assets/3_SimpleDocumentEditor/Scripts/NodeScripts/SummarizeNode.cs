using System;
using RuntimeNodeEditor;
using TMPro;
using UnityEngine;

public class SummarizeNode: Node
{
    [Header("UI")]
    public TMP_Text statusText;                 // optional status/preview
    public TMP_InputField instructionOverride;  // optional system prompt

    [Header("Sockets")]
    public SocketInput  inputSocket;            // expects string
    public SocketOutput outputSocket;           // emits string

    // Track a single upstream source (latest connected wins)
    private IOutput _upstream;

    private const string DefaultSystemPrompt =
        "You are a concise academic assistant. Summarize the user's text in 1–2 sentences. " +
        "Output only LaTeX-safe prose (no environments), suitable for inclusion in a paragraph.";

    public override void Setup()
    {
        Register(outputSocket);
        Register(inputSocket);

        SetHeader("Summarize");
        outputSocket.SetValue(string.Empty);
        statusText?.SetText("idle");

        OnConnectionEvent += OnConnected;
        OnDisconnectEvent += OnDisconnected;

        if (instructionOverride != null)
            instructionOverride.onEndEdit.AddListener(_ => RequestSummary());
    }

    public override void OnSerialize(Serializer s)
    {
        s.Add("instr", instructionOverride != null ? instructionOverride.text : "");
    }

    public override void OnDeserialize(Serializer s)
    {
        var instr = s.Get("instr");
        if (instructionOverride != null)
            instructionOverride.SetTextWithoutNotify(instr);
        RequestSummary();
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

        string sys = (instructionOverride != null && !string.IsNullOrWhiteSpace(instructionOverride.text))
            ? instructionOverride.text
            : DefaultSystemPrompt;

        statusText?.SetText("queued…");
        Debug.Log("Queue-Ing");
        _ = LlmQueue.Instance.Enqueue(
            userContent: inputText,
            systemPrompt: sys,
            responseFormat: null,
            onSuccess: summary =>
            {
                // NOTE: minimal version — accepts last callback even if upstream changed.
                outputSocket.SetValue(summary ?? string.Empty);
                statusText?.SetText(Preview(summary));
            },
            onError: ex =>
            {
                Debug.LogError(ex);
                outputSocket.SetValue(string.Empty);
                statusText?.SetText($"error: {ex.Message}");
            }
        );
    }

    private static string Preview(string s)
    {
        if (string.IsNullOrEmpty(s)) return "done (empty)";
        const int max = 60;
        return s.Length <= max ? s : s.Substring(0, max) + "…";
    }
}
