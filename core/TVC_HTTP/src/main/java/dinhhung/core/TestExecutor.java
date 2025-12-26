package dinhhung.core;

import dinhhung.App;
import dinhhung.config.TestConfig;
import lombok.Setter;
import okhttp3.*;
import org.everit.json.schema.Schema;
import org.everit.json.schema.loader.SchemaLoader;
import org.json.JSONObject;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

public class TestExecutor {

    @Setter
    private Map<String, String> queryParams = new HashMap<>();
    @Setter
    private Map<String, String> headers = new HashMap<>();
    private static OkHttpClient client;
    private final TestCase testCase;
    private final TestConfig testConfig;
    @Setter
    private String schema = null;

    public TestExecutor(TestConfig testConfig, TestCase testCase) {
        this.testCase = testCase;
        this.testConfig = testConfig;
    }

    public void execute() {
        client = new OkHttpClient.Builder()
                .retryOnConnectionFailure(true)
                .connectTimeout(testConfig.getConnectTimeout(), TimeUnit.SECONDS)
                .readTimeout(testConfig.getReadTimeout(), TimeUnit.SECONDS)
                .build();

        long startTime = System.currentTimeMillis();
        try {
            TestConnection tc = new TestConnection(testConfig.getActiveEnv() + testCase.getApi(), testCase.getMethod());
            String authToken = testCase.getAuthTokenStatus();
            if ("GET".equalsIgnoreCase(authToken) && testConfig.getAuth_token() != null && !testConfig.getAuth_token().isEmpty()) {
                tc.setAuthToken(testConfig.getAuth_token());
            } else if (!"GET".equalsIgnoreCase(authToken) && !"SET".equalsIgnoreCase(authToken) && authToken != null) {
                tc.setAuthToken(authToken);
            }
            HttpUrl.Builder urlBuilder = Objects.requireNonNull(HttpUrl.parse(tc.getRequest().url().toString())).newBuilder();
            queryParams.forEach(urlBuilder::addQueryParameter);
            Request.Builder requestBuilder = new Request.Builder().url(urlBuilder.build());
            headers.forEach(requestBuilder::addHeader);
            String authHeader = tc.getRequest().header("Authorization");
            if (authHeader != null) {
                requestBuilder.addHeader("Authorization", authHeader);
            }
            switch (testCase.getMethod()) {
                case GET:
                    requestBuilder.get();
                    break;
                case POST:
                    requestBuilder.post(RequestBody.create(testCase.getBody() != null ? testCase.getBody().getBytes() : new byte[0], MediaType.parse("application/json")));
                    break;
                case PUT:
                    requestBuilder.put(RequestBody.create(testCase.getBody() != null ? testCase.getBody().getBytes() : new byte[0], MediaType.parse("application/json")));
                    break;
                case PATCH:
                    requestBuilder.patch(RequestBody.create(testCase.getBody() != null ? testCase.getBody().getBytes() : new byte[0], MediaType.parse("application/json")));
                    break;
                case DELETE:
                    requestBuilder.delete();
                    break;
                case HEAD:
                    requestBuilder.head();
                    break;
                case OPTIONS:
                    requestBuilder.method("OPTIONS", null);
                    break;
            }

            try (Response response = retryRequest(requestBuilder.build(), testConfig.getMaxRetries())) {

                long duration = System.currentTimeMillis() - startTime;
                testCase.setResponseTimeMs(duration);
                testCase.setResponse(response);
                String responseBody = response.body() != null ? response.body().string() : "";
                testCase.setResponseBody(responseBody);
                if ("SET".equalsIgnoreCase(authToken) && response.isSuccessful()) {
                    String accessToken = Utils.extractJsonField(responseBody, "access_token");
                    if (!accessToken.startsWith("Unknown")) {
                        testConfig.setAuth_token(accessToken);
                    }
                }
                if (schema != null) {
                    try {
                        JSONObject rawSchema = new JSONObject(schema);
                        Schema jsonSchema = SchemaLoader.load(rawSchema);
                        jsonSchema.validate(new JSONObject(responseBody));
                    } catch (Exception e) {
                        System.out.println("[SCHEMA VALIDATION FAILED] " + e.getMessage());
                    }
                }
                displayFullServerResponse(response, responseBody, duration);
            }


        } catch (Exception e) {
            testCase.setResponseTimeMs(System.currentTimeMillis() - startTime);
            testCase.setResponse(null);
            // TODO: Log error
        } finally {
            if (testCase.getResponseValidator() != null) {
                testCase.getResponseValidator().validate(testCase);
            }
        }
    }

    private Response retryRequest(Request request, int retries) throws IOException {
        IOException lastException = null;
        for (int i = 0; i < retries; i++) {
            try {
                return client.newCall(request).execute();
            } catch (IOException e) {
                lastException = e;
                if (i == retries - 1) {
                    throw e;
                }
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }
            }
        }
        throw Objects.requireNonNull(lastException);
    }

    private void displayFullServerResponse(Response response, String responseBody, long durationMs) {
        if (App.IS_DEV_MODE){
            StringBuilder sb = new StringBuilder();

            sb.append("\n");
            sb.append("============================================================\n");
            sb.append("[SERVER FULL RESPONSE]\n");
            sb.append("------------------------------------------------------------\n");

            sb.append("URL            : ").append(response.request().url()).append("\n");
            sb.append("Method         : ").append(response.request().method()).append("\n");
            sb.append("Status Code    : ").append(response.code()).append("\n");
            sb.append("Status Message : ").append(response.message()).append("\n");
            sb.append("Response Time  : ").append(durationMs).append(" ms\n");

            sb.append("------------------------------------------------------------\n");
            sb.append("[HEADERS]\n");
            response.headers().toMultimap().forEach((key, values) ->
                    sb.append(key).append(" : ").append(String.join(", ", values)).append("\n")
            );

            sb.append("------------------------------------------------------------\n");
            sb.append("[BODY]\n");
            sb.append(responseBody.isEmpty() ? "(empty body)" : responseBody).append("\n");

            sb.append("============================================================\n");

            System.out.println(sb);
        }
    }
}