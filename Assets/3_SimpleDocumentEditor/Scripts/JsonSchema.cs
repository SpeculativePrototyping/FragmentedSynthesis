// JsonSchemas.cs
using System;
using Newtonsoft.Json.Linq;

public static class JsonSchemas
{
   public static JObject BuildKeyPointsSchema(int n, bool exactCount = true, int minCharsPerPoint = 0)
   {
      if (n < 1) throw new ArgumentOutOfRangeException(nameof(n));
      if (minCharsPerPoint < 0) throw new ArgumentOutOfRangeException(nameof(minCharsPerPoint));

      var props = new JObject();
      var required = new JArray();
      for (int i = 1; i <= n; i++)
      {
         string key = $"point{i}";
         props[key] = new JObject {
            ["type"] = "string",
            ["minLength"] = minCharsPerPoint,
            ["maxLength"] = 280
         };
         if (exactCount) required.Add(key);
      }

      var schema = new JObject {
         ["$schema"] = "http://json-schema.org/draft-07/schema#",
         ["type"] = "object",
         ["additionalProperties"] = false,
         ["properties"] = props
      };
      if (exactCount) schema["required"] = required;

      return new JObject {
         ["type"] = "json_schema",
         ["json_schema"] = new JObject {
            ["name"] = "key_points",
            ["strict"] = true,
            ["schema"] = schema
         }
      };
   }
}