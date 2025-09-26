using System;
using System.Collections.Generic;
using RuntimeNodeEditor;
using UnityEngine;
using UnityEngine.EventSystems;


public class DocNodeEditor: NodeEditor {
   private string _savePath;

   private ContextMenuBuilder RightClickContext;
   
   public override void StartEditor(NodeGraph graph) {
      base.StartEditor(graph);
Debug.Log(JsonSchemas.BuildKeyPointsSchema(3));
      _savePath = Application.dataPath + "/3_SimpleDocumentEditor/Resources/graph.json";

      Events.OnGraphPointerClickEvent += OnGraphPointerClick;
      Events.OnNodePointerClickEvent += OnNodePointerClick;
      Events.OnConnectionPointerClickEvent += OnNodeConnectionPointerClick;
      Events.OnSocketConnect += OnConnect;

      Graph.SetSize(Vector2.one * 20000);
      
      GameObject[] prefabs = Resources.LoadAll<GameObject>("Nodes/");
      RightClickContext = new ContextMenuBuilder();
         
      foreach (var prefab in prefabs) {
         if (prefab == null) continue;

         // Optional: only include prefabs that have a Node on root
         if (prefab.GetComponent<Node>() == null) continue;

         string pathCopy = "Nodes/" + prefab.name; // Resources path (no .prefab)
         RightClickContext.Add($"nodes/{prefab.name}", () => {
            var p = Resources.Load<GameObject>(pathCopy);
            if (p == null) { Debug.LogError($"Missing prefab at {pathCopy}"); return; }
            Graph.Create(pathCopy);       // or Graph.Create(p) depending on API
            CloseContextMenu();
         });
      }

      RightClickContext.Add("graph/load", () => LoadGraph(_savePath));
      RightClickContext.Add("graph/save", () => SaveGraph(_savePath));

      Debug.Log("StartedDocEditor");
   }

   private void OnConnect(SocketInput arg1, SocketOutput arg2) {
      Graph.drawer.SetConnectionColor(arg2.connection.connId, Color.green);
   }

   private void OnGraphPointerClick(PointerEventData eventData) {
      switch (eventData.button) {
         case PointerEventData.InputButton.Right: {
            var menu = RightClickContext?.Build();
            if (menu == null) { Debug.LogError("Context menu is null (builder empty or prefab ref missing)."); return; }
            
            SetContextMenu(menu);
            DisplayContextMenu();
         }
            break;
         case PointerEventData.InputButton.Left: CloseContextMenu(); break;
      }
   }

   private void SaveGraph(string savePath) {
      CloseContextMenu();
      Graph.SaveFile(savePath);
   }

   private void LoadGraph(string savePath) {
      CloseContextMenu();
      Graph.Clear();
      Graph.LoadFile(savePath);
   }

   private void OnNodePointerClick(Node node, PointerEventData eventData) {
      if (eventData.button == PointerEventData.InputButton.Right) {
         var ctx = new ContextMenuBuilder()
            .Add("duplicate", () => DuplicateNode(node))
            .Add("clear connections", () => ClearConnections(node))
            .Add("delete", () => DeleteNode(node))
            .Build();

         SetContextMenu(ctx);
         DisplayContextMenu();
      }
   }

   private void OnNodeConnectionPointerClick(string connId, PointerEventData eventData) {
      if (eventData.button == PointerEventData.InputButton.Right) {
         var ctx = new ContextMenuBuilder()
            .Add("clear connection", () => DisconnectConnection(connId))
            .Build();

         SetContextMenu(ctx);
         DisplayContextMenu();
      }
   }


   



   private void DeleteNode(Node node) {
      Graph.Delete(node);
      CloseContextMenu();
   }

   private void DuplicateNode(Node node) {
      Graph.Duplicate(node);
      CloseContextMenu();
   }

   private void DisconnectConnection(string line_id) {
      Graph.Disconnect(line_id);
      CloseContextMenu();
   }

   private void ClearConnections(Node node) {
      Graph.ClearConnectionsOf(node);
      CloseContextMenu();
   }
}