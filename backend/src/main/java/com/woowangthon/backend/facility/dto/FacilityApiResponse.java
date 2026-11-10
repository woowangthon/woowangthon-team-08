package com.woowangthon.backend.facility.dto;

import com.fasterxml.jackson.annotation.JsonProperty; //json필드와 java변수명 연결해주는 어노테이션
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
//외부 공공 API에서 보내주는 JSON 데이터를 Java 객체로 변환하기 위한 클래스
public class FacilityApiResponse {
    @JsonProperty("AFCS_NM")
    private String name;

    @JsonProperty("AFCS_SE_CODE")
    private String categoryCode;

    @JsonProperty("TELNO")
    private String phone;

    @JsonProperty("LOCPLC_ADRES")
    private String address;

    @JsonProperty("HMPG")
    private String homepage;
}
