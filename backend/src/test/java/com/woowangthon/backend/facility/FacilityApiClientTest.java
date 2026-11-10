package com.woowangthon.backend.facility;

import com.woowangthon.backend.facility.client.FacilityApiClient;
import com.woowangthon.backend.facility.dto.FacilityApiResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class FacilityApiClientTest {

    @Autowired
    private FacilityApiClient facilityApiClient;

    @Test
    void fetchFacilitiesTest() {
        List<FacilityApiResponse> response = facilityApiClient.fetchFacilities();

        System.out.println("총 " + response.size() + "건");
        response.stream().limit(3).forEach(f ->
                System.out.println(f.getName() + " / " + f.getPhone()));

        assertThat(response).isNotEmpty();   // 데이터가 1건 이상 왔는지 검증
    }
}