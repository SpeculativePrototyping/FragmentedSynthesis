using UnityEngine;

namespace RuntimeNodeEditor
{
    public abstract class Socket : MonoBehaviour
    {
        public Node             OwnerNode { get { return _ownerNode; } }
        public ISocketEvents    Events    { get { return _socketEvents; } }
        
        public string           socketId;
        public SocketHandle     handle;
        public ConnectionType   connectionType;
        private Node            _ownerNode;
        private ISocketEvents   _socketEvents;
        private NodeGraph       _graph;

        public void SetOwner(Node owner, ISocketEvents events,NodeGraph mainGraph) {
            
            _ownerNode = owner;
            _socketEvents = events;
            
            _graph = mainGraph;
            socketId = _graph.GetNewId();
            
            Setup();
        }

        public virtual void Setup() { }
        public abstract bool HasConnection();

    }
}