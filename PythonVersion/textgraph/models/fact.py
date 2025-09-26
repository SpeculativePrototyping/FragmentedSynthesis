from qtpy.QtWidgets import QLineEdit
from qtpynodeeditor import NodeDataModel, PortType
from ..text_data import TextData

class FactModel(NodeDataModel):
    """One-line text source; updates only on editingFinished."""
    name = "Fact"
    caption_visible = True
    num_ports = {PortType.input: 0, PortType.output: 1}
    port_caption_visible = True
    port_caption = {'output': {0: 'text'}}
    data_type = TextData.data_type

    def __init__(self, style=None, parent=None):
        super().__init__(style=style, parent=parent)
        self._current = TextData("")
        self._line = QLineEdit()
        self._line.setPlaceholderText("Type a fact… (Enter or focus-out to commit)")
        self._line.editingFinished.connect(self._commit)

    @property
    def caption(self):
        return self.name

    def embedded_widget(self):
        return self._line

    def out_data(self, port: int):
        return self._current

    def set_in_data(self, data, port):
        pass  # no inputs

    # debounce: only emit when editing ends
    def _commit(self):
        self._current = TextData(self._line.text())
        self.data_updated.emit(0)
