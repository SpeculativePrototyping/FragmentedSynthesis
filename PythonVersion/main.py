# text_concat_nodes.py
import logging
from qtpy import QtCore, QtWidgets
from qtpy.QtWidgets import QApplication, QLineEdit, QTextEdit, QWidget, QPushButton, QHBoxLayout, QVBoxLayout
from qtpynodeeditor import (
    NodeData, NodeDataType, NodeDataModel,
    DataModelRegistry, FlowScene, FlowView,
    PortType, NodeValidationState
)




# -------- Payload --------
class TextData(NodeData):
    data_type = NodeDataType(id="text", name="Text")
    def __init__(self, text: str = ""):
        super().__init__()
        self.text = text or ""

# -------- Fact (source) — emits only on editingFinished --------
class FactModel(NodeDataModel):
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
        self._line.setPlaceholderText("Type a short fact… (updates on Enter or focus loss)")
        # only fire when user stops editing (Enter/tab/click away):
        self._line.editingFinished.connect(self._on_editing_finished)

    @property
    def caption(self): return self.name
    def embedded_widget(self) -> QWidget: return self._line
    def out_data(self, port: int) -> NodeData: return self._current
    def set_in_data(self, data, port): pass

    def _on_editing_finished(self):
        self._current = TextData(self._line.text())
        self.data_updated.emit(0)  # notify once

# -------- ConcatViewer (sink) — dynamic input ports, manual update --------
class ConcatViewerModel(NodeDataModel):
    """
    Dynamically add/remove input ports. Concatenates all incoming TextData.
    Recompute only when user presses 'Update' (debounced UX).
    """
    name = "ConcatViewer"
    caption_visible = True

    # start with 1 input; 0 outputs
    num_ports = {PortType.input: 1, PortType.output: 0}
    data_type  = TextData.data_type
    port_caption_visible = True

    def __init__(self, style=None, parent=None):
        super().__init__(style=style, parent=parent)

        # dynamic inputs
        self._in_count = 1
        self._slots: list[str] = [""]  # latest text per input index

        # UI
        self._view = QTextEdit(); self._view.setReadOnly(True)
        self._btn_add = QPushButton("+")
        self._btn_del = QPushButton("–")
        self._btn_update = QPushButton("Update")

        self._btn_add.setToolTip("Add input")
        self._btn_del.setToolTip("Remove last input")
        self._btn_update.setToolTip("Concatenate now")

        btns = QHBoxLayout()
        btns.addWidget(self._btn_add); btns.addWidget(self._btn_del); btns.addStretch(1); btns.addWidget(self._btn_update)

        wrap = QWidget()
        lay = QVBoxLayout(wrap); lay.setContentsMargins(6,6,6,6)
        lay.addLayout(btns); lay.addWidget(self._view)

        self._widget = wrap

        # state/validation
        self._validation_state = NodeValidationState.warning
        self._validation_message = "Waiting for inputs"

        # wire
        self._btn_add.clicked.connect(self._add_input)
        self._btn_del.clicked.connect(self._del_input)
        self._btn_update.clicked.connect(self._recompute)

    # ----- API expected by qtpynodeeditor -----
    @property
    def caption(self): return self.name
    def embedded_widget(self) -> QWidget: return self._widget

    def nPorts(self, portType: PortType) -> int:
        # some versions call this; keep in sync with _in_count
        return self._in_count if portType == PortType.input else 0

    def dataType(self, portType: PortType, portIndex: int) -> NodeDataType:
        return TextData.data_type

    def portCaption(self, portType: PortType, portIndex: int) -> str:
        if portType == PortType.input: return f"text[{portIndex}]"
        return ""

    def portCaptionVisible(self, portType: PortType, portIndex: int) -> bool:
        return True

    def set_in_data(self, data: NodeData, port):
        idx = getattr(port, "index", None)
        if isinstance(idx, int) and 0 <= idx < self._in_count:
            self._slots[idx] = data.text if isinstance(data, TextData) else ""
            # NOTE: do NOT recompute here (debounced); require button press
        # no outputs; nothing to emit

    def validation_state(self): return self._validation_state
    def validation_message(self): return self._validation_message

    # ----- Dynamic inputs -----
    def _emit_port_count_changed(self):
        # notify the graph that input port count changed
        for sig in ("port_count_changed", "portCountChanged"):
            s = getattr(self, sig, None)
            if s:
                try:
                    s.emit(PortType.input, self._in_count)
                    return
                except Exception:
                    pass

    def _add_input(self):
        self._in_count += 1
        self._slots.append("")
        self._emit_port_count_changed()

    def _del_input(self):
        if self._in_count > 1:
            self._in_count -= 1
            self._slots.pop()
            self._emit_port_count_changed()

    # ----- Compute on demand -----
    def _recompute(self):
        parts = [t for t in self._slots if t]
        text = "\n".join(parts)
        if parts:
            self._validation_state = NodeValidationState.valid
            self._validation_message = ""
        else:
            self._validation_state = NodeValidationState.warning
            self._validation_message = "No text inputs"
        self._view.setPlainText(text)

def set_node_pos(scene, node, x, y):
    # Try snake_case API first
    try:
        return scene.set_node_position(node, QtCore.QPointF(x, y))
    except AttributeError:
        pass
    # Try camelCase API
    try:
        return scene.setNodePosition(node, QtCore.QPointF(x, y))
    except AttributeError:
        pass
    # Fall back to graphics object (QGraphicsItem-like)
    try:
        return node.graphics_object.setPos(x, y)
    except Exception:
        pass
    # Last resort: node itself may be a QGraphicsItem
    try:
        return node.setPos(x, y)
    except Exception:
        pass


# -------- App scaffold --------
def main():
    
    logging.basicConfig(level="INFO")
    app = QApplication([])

    reg = DataModelRegistry()
    reg.register_model(FactModel, category="Text")
    reg.register_model(ConcatViewerModel, category="Text")

    scene = FlowScene(registry=reg)
    view = FlowView(scene); view.setWindowTitle("Dynamic Concat Viewer"); view.resize(900, 520); view.show()

    # nodes
    f1 = scene.create_node(FactModel)
    f2 = scene.create_node(FactModel)
    v  = scene.create_node(ConcatViewerModel)

    # lay them out
    set_node_pos(scene, f1, -250, -80)
    set_node_pos(scene, f2, -250,  80)
    set_node_pos(scene, v,   150,   0)

#     # connect initial inputs 0 and (after add) 1
#     scene.create_connection(f1[PortType.output][0], v[PortType.input][0])

#     # Make a second port then connect f2 → v.in[1]
#     v.model._add_input()
#     scene.create_connection(f2[PortType.output][0], v[PortType.input][1])

#     # prefill sample
#     f1.model.embedded_widget().setText("First fact (press Enter to commit).")
#     f2.model.embedded_widget().setText("Second fact (press Enter to commit).")
# ````
    app.exec_()

if __name__ == "__main__":
    main()
