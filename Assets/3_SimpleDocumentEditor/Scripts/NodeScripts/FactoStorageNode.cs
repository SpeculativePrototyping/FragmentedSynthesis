using UnityEngine;
using UnityEngine.UI;
using RuntimeNodeEditor;
using TMPro;
using UnityEditor.Hardware;
using UnityEngine.Serialization;
using UnityEngine.UIElements;

public class FactoStorageNode : Node {
   [FormerlySerializedAs("valueField")] public TMP_InputField factField;

   public SocketOutput StringOutput;

   public override void Setup() {
      StringOutput.connectionType = ConnectionType.Multiple;
      

      HandleFieldValue(factField.text);

      factField.contentType = TMP_InputField.ContentType.Autocorrected;
      factField.onEndEdit.AddListener(HandleFieldValue);

      Register(StringOutput);
      SetHeader("Fact");

      //OnConnectionEvent += OnConnection;
     // OnDisconnectEvent += OnDisconnect;
   }

   private void HandleFieldValue(string value) {
      StringOutput.SetValue(value);
   }

   

   public override void OnSerialize(Serializer serializer) {
      serializer.Add("factValue", factField.text);
   }

   public override void OnDeserialize(Serializer serializer) {
      var value = serializer.Get("factValue");
      factField.SetTextWithoutNotify(value);

      HandleFieldValue(value);
   }
}