using UnityEngine;
using UnityEngine.UI;
using RuntimeNodeEditor;
using TMPro; // or whatever namespace your Node base class is in

public class TextDisplayNode : Node
{
   public TMP_Text uiText;              // A UnityEngine.UI.Text component in your prefab

   public SocketInput textInput;    // The input socket

   private IOutput _textChannel;

   public override void Setup()
   {
      textInput.connectionType = ConnectionType.Single;

      Register(textInput);

      SetHeader("Text Display");

      OnConnectionEvent += OnConnection;
      OnDisconnectEvent += OnDisconnect;
   }

   private void OnConnection(SocketInput input, IOutput output)
   {
      if (input == textInput)
      {
         _textChannel = output;
         _textChannel.ValueUpdated += RefreshDisplay;
      }
      RefreshDisplay();
   }

   private void OnDisconnect(SocketInput input, IOutput output)
   {
      if (input == textInput && _textChannel != null)
      {
         _textChannel.ValueUpdated -= RefreshDisplay;
         _textChannel = null;
      }
      RefreshDisplay();
   }

   private void RefreshDisplay()
   {
      string text = string.Empty;
      if (_textChannel != null)
      {
         text = _textChannel.GetValue<string>();
      }

      if (uiText != null)
         uiText.text = text;
   }
}