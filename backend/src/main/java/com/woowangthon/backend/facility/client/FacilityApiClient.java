package com.woowangthon.backend.facility.client;

import com.woowangthon.backend.facility.dto.FacilityApiResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.HtmlUtils;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

@Component
// API 주소에 요청을 보내고 응답을 정제해서 DTO 리스트로 변환하는 부분
public class FacilityApiClient {
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;

    public FacilityApiClient(
            RestClient.Builder builder,
            ObjectMapper objectMapper,
            @Value("${mental-health-api.base-url}") String baseUrl,
            @Value("${mental-health-api.key}") String apiKey
    ) {
        this.restClient = builder.baseUrl(baseUrl).build();
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
    }

    public List<FacilityApiResponse> fetchFacilities() {
        // 1) 응답을 문자열로 받기 (text/html이라 JsonNode로는 못 받음)
        String raw = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/healthFacJson.do")
                        .queryParam("key", apiKey)
                        .build())
                .retrieve()
                .body(String.class);

        // 2) 정제: <div> 태그 제거 + &#034; 같은 HTML 엔티티를 " 로 복원
        String json = HtmlUtils.htmlUnescape(raw.replaceAll("</?div>", "").trim());

        // 3) JSON 문자열을 DTO 리스트로 변환
        try {
            List<FacilityApiResponse> list = objectMapper.readValue(
                    json, new TypeReference<List<FacilityApiResponse>>() {});
            return list.stream().skip(1).toList();   // 첫 번째 헤더 행("기관명" 등) 제외
        } catch (JacksonException e) {
            throw new IllegalStateException("시설 API 응답 파싱 실패", e);
        }
    }
}