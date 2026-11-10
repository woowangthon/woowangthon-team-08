package com.woowangthon.backend.facility;

import com.woowangthon.backend.facility.client.FacilityApiClient;
import com.woowangthon.backend.facility.dto.FacilityApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FacilityService {

    private final FacilityApiClient facilityApiClient;
    private final FacilityRepository facilityRepository;

    @Transactional
    public int importFacilities() {
        List<FacilityApiResponse> responses = facilityApiClient.fetchFacilities();

        List<Facility> entities = responses.stream()
                .map(this::toEntity)
                .toList();

        facilityRepository.saveAll(entities);
        return entities.size();
    }

    private Facility toEntity(FacilityApiResponse dto) {
        // 엔티티의 실제 생성 방식(빌더/생성자/정적 팩토리)에 맞게 수정하세요
        return Facility.builder()
                .name(clean(dto.getName()))
                .categoryCode(clean(dto.getCategoryCode()))
                .phone(clean(dto.getPhone()))
                .address(clean(dto.getAddress()))
                .homepage(normalizeHomepage(dto.getHomepage()))
                .build();
    }

    private String clean(String value) {
        return value == null ? null : value.strip();
    }

    private String normalizeHomepage(String url) {
        String v = clean(url);
        if (v == null || v.isBlank()) return null;
        if (v.startsWith("http://") || v.startsWith("https://")) return v;
        return "https://" + v;
    }
}