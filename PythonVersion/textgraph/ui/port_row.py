from qtpy.QtCore import Signal
from qtpy.QtWidgets import QWidget, QHBoxLayout, QLineEdit, QLabel

class PortRow(QWidget):
    """
    Inline editor for one input port.
    - Shows a tiny label (e.g., [0]) and a one-line QLineEdit.
    - Emits `committed(text)` only on editingFinished (debounced).
    """
    committed = Signal(str)

    def __init__(self, index: int):
        super().__init__()
        self.index = index
        self.label = QLabel(f"[{index}]")
        self.edit = QLineEdit()
        self.edit.setPlaceholderText("type… (Enter/focus-out to commit)")
        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(6)
        lay.addWidget(self.label)
        lay.addWidget(self.edit)
        self.edit.editingFinished.connect(self._on_done)

    def _on_done(self):
        self.committed.emit(self.edit.text())

    def set_index(self, idx: int):
        self.index = idx
        self.label.setText(f"[{idx}]")

    def set_text(self, text: str):
        self.edit.blockSignals(True)
        self.edit.setText(text or "")
        self.edit.blockSignals(False)

    def text(self) -> str:
        return self.edit.text()
