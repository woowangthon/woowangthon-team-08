package com.woowangthon.backend.facility;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import lombok.extern.slf4j.Slf4j;

@Component
@Profile("facility-import")
@RequiredArgsConstructor
@Slf4j
public class FacilityImportRunner implements ApplicationRunner {

    private final FacilityService facilityService;
    private final FacilityRepository facilityRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (facilityRepository.count() > 0) {
            log.info("기관 데이터가 이미 있어 초기 적재를 건너뜁니다.");
            return;
        }

        int savedCount = facilityService.importFacilities();
        log.info("기관 데이터 초기 적재 완료. 저장 건수 = {}", savedCount);
    }
}