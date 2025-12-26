package dinhhung.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public class Utils {
    private static final ObjectMapper mapper = new ObjectMapper();

    public static String extractJsonField(String json, String field) {
        if (json != null && field != null && !json.trim().isEmpty() && !field.trim().isEmpty()) {
            try {
                JsonNode rootNode = mapper.readTree(json);
                if (rootNode.has(field) && !rootNode.get(field).isNull()) {
                    JsonNode fieldNode = rootNode.get(field);
                    return fieldNode.asText();
                }
                return "[TVC]: Field '" + field + "' not found. Please check whether this custom field is configured in the API response configuration.";
            } catch (Exception e) {
                return "[TVC]: Invalid target API response (possible 404 status).";
            }
        } else {
            return "[TVC]: Invalid input";
        }
    }
}