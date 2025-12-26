package dinhhung.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Setter
@Getter
public class Environment {
    @JsonProperty("name")
    private String name;

    private String url;
    private boolean active;
}