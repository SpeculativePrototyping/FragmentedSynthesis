using UnityEngine;
using RuntimeNodeEditor;


    public class ApplicationStartup : MonoBehaviour
    {
        public RectTransform    editorHolder;
        public DocNodeEditor    editor;

        private void Start()
        {
            Application.targetFrameRate = 60;
            var graph = editor.CreateGraph<NodeGraph>(editorHolder);
            editor.StartEditor(graph);
        }
    }
