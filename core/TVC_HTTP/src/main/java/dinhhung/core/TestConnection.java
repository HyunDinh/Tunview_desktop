package dinhhung.core;

import lombok.Getter;
import okhttp3.Request;

@Getter
public class TestConnection {
    private Request request;

    public TestConnection(String api, HttpMethod method) {
        try {
            Request.Builder requestBuilder = new Request.Builder().url(api);
            switch (method) {
                case POST, PATCH, PUT:
                    requestBuilder.addHeader("Accept", "application/json");
                    break;
                case GET:
                    requestBuilder.get().addHeader("Accept", "application/json");
                    break;
                case DELETE:
                    requestBuilder.delete().addHeader("Accept", "application/json");
                    break;
                case HEAD:
                    requestBuilder.head().addHeader("Accept", "application/json");
                    break;
                case OPTIONS:
                    requestBuilder.method("OPTIONS", null).addHeader("Accept", "application/json");
                    break;
            }
            request = requestBuilder.build();
        } catch (Exception e) {
            // TODO: Xử lý lỗi, có thể log ra STDERR dưới dạng JSON log
        }
    }

    public void setAuthToken(String token) {
        if (token != null && !token.isEmpty()) {
            request = new Request.Builder()
                    .url(request.url())
                    .method(request.method(), request.body())
                    .addHeader("Authorization", "Bearer " + token)
                    .addHeader("Accept", "application/json")
                    .build();
        }
    }
}