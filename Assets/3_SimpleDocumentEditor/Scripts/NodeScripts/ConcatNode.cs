using System;
using System.Collections.Generic;
using System.Linq;
using RuntimeNodeEditor;
using Unity.VisualScripting;
using UnityEngine;
using UnityEngine.UI;

public class ConcatNode : Node
{
    [Header("UI")]
    public RectTransform inputsHost;
    public GameObject inputSocketPrefab;

    [Header("Sockets")]
    public SocketOutput outputSocket;

    private readonly List<SocketInput> _order = new();                // ordered inputs
    private readonly Dictionary<SocketInput, IOutput> _channels = new(); // input -> upstream output

    public override void Setup()
    {
        Register(outputSocket);
        SetHeader("Concat");

        EnsureBaselineSockets();

        OnConnectionEvent += OnConnected;
        OnDisconnectEvent += OnDisconnected;

        Recompute();
    }

    // ----- dynamic sockets -----

    private void EnsureBaselineSockets()
    {
        if (_order.Count == 0)
        {
            AddInputSocket(); // first real
           
        }
        ForceLayout();
    }

    private SocketInput AddInputSocket()
    {
        var go = Instantiate(inputSocketPrefab, inputsHost, false);
        var si = go.GetComponent<SocketInput>() ?? throw new Exception("inputSocketPrefab missing SocketInput");
        si.connectionType = ConnectionType.Single;


        Register(si);
        _order.Add(si);
        return si;
    }

    private void RemoveInputSocket(SocketInput si)
    {
        
        if (si == null) return;

        // detach channel listener if present
        if (_channels.TryGetValue(si, out var ch)) {
            ch.ValueUpdated -= Recompute;
            _channels.Remove(si);
            
           
        }
        DeRegister(si);
        _order.Remove(si);
        Destroy(si.gameObject);
    }

    private void ForceLayout() {

        if (isLoading()) return;
        // Ensure: last is spare; collapse empty middles
        var last = _order.Count > 0 ? _order[^1] : null;
        Debug.Log($"Whats last{last}");
        // if last got connected, add new spare
        if (last == null) return;
        else if (last != null && last.HasConnection()) AddInputSocket();

        Debug.Log("Forcing a layour rework!");
        /*foreach (var input in _order) {
            if (input != null && input.HasConnection()) {
                if (!_channels.ContainsKey(input)) {
                    var output = input.Connections.FirstOrDefault().output;
                    if (output != null) {
                        _channels.Add(input, input.Connections.FirstOrDefault().output);
                        Debug.Log(
                            $"We are loading so we are trying to find back our original connections {input}{input.Connections.FirstOrDefault().output}");
                    }
                }
            }
        }
*/
        // remove any unconnected inputs that are not the last (spare)
        var toDelete = new List<SocketInput>();
        for (int i = 0; i < _order.Count - 1; i++)
            if (!_channels.ContainsKey(_order[i]))
                toDelete.Add(_order[i]);
        if (toDelete.Count > 0)
            StartCoroutine(PruneNextFrame(toDelete));
    }
    
    private System.Collections.IEnumerator PruneNextFrame(List<SocketInput> toRemove)
    {
        yield return new WaitForNextFrameUnit();
        Debug.Log("About to delete some sockets");
        foreach (var si in toRemove)
            RemoveInputSocket(si);
        Debug.Log("Deleted them");
        
        if (inputsHost) {
            int i = 0;
            _order.ForEach(val =>val.transform.SetSiblingIndex(i++));
            LayoutRebuilder.ForceRebuildLayoutImmediate(inputsHost);
            Canvas.ForceUpdateCanvases();
            ReDrawLines();
        }
    }

    // ----- events -----

    private void OnConnected(SocketInput input, IOutput output)
    {
        if (!_order.Contains(input)) return;

        // attach data channel
        _channels.Add(input, output);
        output.ValueUpdated += Recompute;

        ForceLayout();
        Recompute();
    }

    private void OnDisconnected(SocketInput input, IOutput output)
    {
        if (_channels.TryGetValue(input, out var ch))
        {
            ch.ValueUpdated -= Recompute;
            _channels.Remove(input);
        }

        ForceLayout();
        Recompute();
    }

    // ----- compute -----

    private void Recompute()
    {
        const string sep = "\r\n";
        var parts = new List<string>(_order.Count);

        foreach (var si in _order)
        {
            if (_channels.TryGetValue(si, out var ch)) {
                var s = ch.GetValue<string>() ?? string.Empty;
                parts.Add(s);
            }
        }

        outputSocket.SetValue(string.Join(sep, parts));
    }

    // ----- persistence -----

    public override void OnSerialize(Serializer s)
    {
        s.Add("in_count", _order.Count.ToString());
    
    }

    public override void OnDeserialize(Serializer s)
    {
        // rebuild to recorded count (≥2: one real + one spare)
        int count = 0;
        int.TryParse(s.Get("in_count"), out count);
        count = Mathf.Max(1, count);
        
        while (_order.Count > 0) RemoveInputSocket(_order[^1]);
        for (int i = 0; i < count; i++) AddInputSocket();
        

        ForceLayout();
        Recompute();
    }

    private void OnDestroy()
    {
        foreach (var ch in _channels.Values)
            if (ch != null) ch.ValueUpdated -= Recompute;
        _channels.Clear();
    }
}
