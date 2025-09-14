import { describe, it, expect } from 'vitest';
import {
    earnedIncomeDeduction,
    progressiveTaxByQuickDeduction,
    earnedIncomeTaxDeductionLimit,
    earnedIncomeTaxDeduction,
    applyEarnedIncomeTaxDeduction
} from './index.js';

describe('근로소득공제 함수 테스트', () => {
    it('총급여 3,380만원인 경우 근로소득공제금액 계산', () => {
        const totalSalary = 33_800_000; // 3,380만원
        const expectedDeduction = 10_320_000; // 1,032만원 = 750만원 + (3,380만원 - 1,500만원) × 15%

        const result = earnedIncomeDeduction(totalSalary);

        expect(result).toBe(expectedDeduction);
    });

    it('총급여 3,380만원인 경우 근로소득금액 계산', () => {
        const totalSalary = 33_800_000; // 3,380만원
        const deduction = earnedIncomeDeduction(totalSalary);
        const expectedEarnedIncome = 23_480_000; // 2,348만원 = 3,380만원 - 1,032만원

        const earnedIncome = totalSalary - deduction;

        expect(earnedIncome).toBe(expectedEarnedIncome);
    });

    it('다양한 급여 구간에서 근로소득공제 계산', () => {
        // 500만원 이하 구간
        expect(earnedIncomeDeduction(3_000_000)).toBe(2_100_000); // 70%

        // 500만원 초과 1,500만원 이하 구간
        expect(earnedIncomeDeduction(10_000_000)).toBe(5_500_000); // 350만원 + (1,000만원 - 500만원) × 40%

        // 1,500만원 초과 4,500만원 이하 구간 (테스트 케이스)
        expect(earnedIncomeDeduction(33_800_000)).toBe(10_320_000); // 750만원 + (3,380만원 - 1,500만원) × 15%

        // 4,500만원 초과 1억원 이하 구간
        expect(earnedIncomeDeduction(60_000_000)).toBe(12_750_000); // 1,200만원 + (6,000만원 - 4,500만원) × 5%

        // 1억원 초과 구간
        expect(earnedIncomeDeduction(150_000_000)).toBe(15_750_000); // 1,475만원 + (1.5억원 - 1억원) × 2%
    });
});

describe('누진공제식 산출세액 함수 테스트', () => {
    it('종합소득과세표준 2,000만원인 경우 산출세액 계산', () => {
        const annualTaxBase = 20_000_000; // 2,000만원
        const expectedTax = 1_740_000; // 1,740,000원 = 84만원 + (2,000만원 - 1,400만원) × 15%

        const result = progressiveTaxByQuickDeduction(annualTaxBase);

        expect(result).toBe(expectedTax);
    });

    it('종합소득과세표준 2,365만원인 경우 산출세액 계산', () => {
        const annualTaxBase = 23_650_000; // 2,365만원
        const expectedTax = 2_287_500; // 2,287,500원 = 84만원 + (2,365만원 - 1,400만원) × 15%

        const result = progressiveTaxByQuickDeduction(annualTaxBase);

        expect(result).toBe(expectedTax);
    });

    it('다양한 과세표준에서 산출세액 계산', () => {
        // 1,400만원 이하 구간 (6% 세율)
        expect(progressiveTaxByQuickDeduction(10_000_000)).toBe(600_000); // 1,000만원 × 6%

        // 1,400만원 초과 5,000만원 이하 구간 (15% 세율, 84만원 공제)
        expect(progressiveTaxByQuickDeduction(20_000_000)).toBe(1_740_000); // 84만원 + (2,000만원 - 1,400만원) × 15%

        // 5,000만원 초과 8,800만원 이하 구간 (24% 세율, 624만원 공제)
        expect(progressiveTaxByQuickDeduction(60_000_000)).toBe(8_640_000); // 624만원 + (6,000만원 - 5,000만원) × 24%

        // 8,800만원 초과 1.5억원 이하 구간 (35% 세율, 1,536만원 공제)
        expect(progressiveTaxByQuickDeduction(100_000_000)).toBe(19_560_000); // 1,536만원 + (1억원 - 8,800만원) × 35%
    });

    it('과세표준이 0원인 경우', () => {
        expect(progressiveTaxByQuickDeduction(0)).toBe(0);
    });

    it('과세표준이 음수인 경우', () => {
        expect(progressiveTaxByQuickDeduction(-1_000_000)).toBe(0);
    });
});

describe('통합 테스트 - 실제 케이스 검증', () => {
    it('총급여 3,380만원 케이스 전체 검증', () => {
        const totalSalary = 33_800_000; // 3,380만원

        // 근로소득공제금액
        const earnedDeduction = earnedIncomeDeduction(totalSalary);
        expect(earnedDeduction).toBe(10_320_000); // 1,032만원

        // 근로소득금액
        const earnedIncome = totalSalary - earnedDeduction;
        expect(earnedIncome).toBe(23_480_000); // 2,348만원
    });

    it('종합소득과세표준 2,000만원 케이스 전체 검증', () => {
        const annualTaxBase = 20_000_000; // 2,000만원

        // 산출세액
        const incomeTax = progressiveTaxByQuickDeduction(annualTaxBase);
        expect(incomeTax).toBe(1_740_000); // 1,740,000원

        // 계산 과정 검증: 84만원 + (2,000만원 - 1,400만원) × 15%
        const manualCalculation = 840_000 + (20_000_000 - 14_000_000) * 0.15;
        expect(incomeTax).toBe(manualCalculation);
    });
});

describe('근로소득세액공제 한도 함수 테스트', () => {
    it('총급여 3,300만원 이하인 경우 74만원 한도', () => {
        expect(earnedIncomeTaxDeductionLimit(30_000_000)).toBe(740_000);
        expect(earnedIncomeTaxDeductionLimit(33_000_000)).toBe(740_000);
    });

    it('총급여 3,300만원 초과 7,000만원 이하인 경우', () => {
        // 5,000만원: 74만원 - (5,000만원 - 3,300만원) × 0.008 = 74만원 - 13.6만원 = 60.4만원 → 최소 66만원
        expect(earnedIncomeTaxDeductionLimit(50_000_000)).toBe(660_000);

        // 7,000만원: 74만원 - (7,000만원 - 3,300만원) × 0.008 = 74만원 - 29.6만원 = 44.4만원 → 최소 66만원
        expect(earnedIncomeTaxDeductionLimit(70_000_000)).toBe(660_000);
    });

    it('총급여 7,000만원 초과 12,000만원 이하인 경우', () => {
        // 10,000만원: 66만원 - (10,000만원 - 7,000만원) × 0.5 = 66만원 - 150만원 = -84만원 → 최소 50만원
        expect(earnedIncomeTaxDeductionLimit(100_000_000)).toBe(500_000);

        // 12,000만원: 66만원 - (12,000만원 - 7,000만원) × 0.5 = 66만원 - 250만원 = -184만원 → 최소 50만원
        expect(earnedIncomeTaxDeductionLimit(120_000_000)).toBe(500_000);
    });

    it('총급여 12,000만원 초과인 경우', () => {
        // 15,000만원: 50만원 - (15,000만원 - 12,000만원) × 0.5 = 50만원 - 150만원 = -100만원 → 최소 20만원
        expect(earnedIncomeTaxDeductionLimit(150_000_000)).toBe(200_000);
    });
});

describe('근로소득세액공제 계산 함수 테스트', () => {
    it('산출세액 130만원 이하인 경우 55% 공제', () => {
        expect(earnedIncomeTaxDeduction(1_000_000)).toBe(550_000); // 100만원 × 55%
        expect(earnedIncomeTaxDeduction(1_300_000)).toBe(715_000); // 130만원 × 55%
    });

    it('산출세액 130만원 초과인 경우 71만5천원 + 초과분의 30%', () => {
        // 200만원: 71만5천원 + (200만원 - 130만원) × 30% = 71.5만원 + 21만원 = 92.5만원
        expect(earnedIncomeTaxDeduction(2_000_000)).toBe(925_000);

        // 500만원: 71만5천원 + (500만원 - 130만원) × 30% = 71.5만원 + 111만원 = 182.5만원
        expect(earnedIncomeTaxDeduction(5_000_000)).toBe(1_825_000);
    });
});

describe('근로소득세액공제 최종 적용 함수 테스트', () => {
    it('산출세액이 한도보다 작은 경우', () => {
        const calculatedTax = 1_000_000; // 100만원
        const totalSalary = 50_000_000; // 5,000만원 (한도: 60.4만원)

        const result = applyEarnedIncomeTaxDeduction(calculatedTax, totalSalary);
        expect(result).toBe(550_000); // 100만원 × 55% = 55만원 (한도보다 작음)
    });

    it('산출세액이 한도보다 큰 경우', () => {
        const calculatedTax = 2_000_000; // 200만원
        const totalSalary = 30_000_000; // 3,000만원 (한도: 74만원)

        const result = applyEarnedIncomeTaxDeduction(calculatedTax, totalSalary);
        expect(result).toBe(740_000); // 한도 74만원 적용
    });

    it('산출세액이 0인 경우', () => {
        const calculatedTax = 0;
        const totalSalary = 50_000_000;

        const result = applyEarnedIncomeTaxDeduction(calculatedTax, totalSalary);
        expect(result).toBe(0);
    });
});
