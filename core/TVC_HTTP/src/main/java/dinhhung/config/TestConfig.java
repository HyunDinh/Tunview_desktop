package dinhhung.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;

@Setter
@Getter
public class TestConfig {
    @JsonProperty("max_retries")
    private int maxRetries = 3;

    @JsonProperty("connect_timeout")
    private int connectTimeout = 10;

    @JsonProperty("read_timeout")
    private int readTimeout = 350;

    private String auth_token; // cần được nâng cấp cho nhiều cơ chế authentication khác

    private ArrayList<Environment> env = new ArrayList<>();

    public String getActiveEnv(){
        for (Environment env : env){
            if (env.isActive()){
                return env.getUrl();
            }
        }
        return null;
    }
}