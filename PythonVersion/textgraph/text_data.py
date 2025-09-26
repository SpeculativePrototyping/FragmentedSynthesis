from qtpynodeeditor import NodeData, NodeDataType

class TextData(NodeData):
    """Text payload."""
    data_type = NodeDataType(id="text", name="Text")

    def __init__(self, text: str = ""):
        super().__init__()
        self.text = text or ""
