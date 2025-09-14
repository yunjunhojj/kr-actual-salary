#!/usr/bin/env node
/**
 * kr-actual-salary
 * 입력: 연봉(만원 단위, 예: 5000)
 * 출력: 월/연 실수령액
 *
 * 정책 수치는 2025 근사 예시(건보 3.545%, 장기요양 12.95%).
 * 필요 시 아래 상수만 업데이트.
 */
import readline from "readline";

// ------------------------------
// 1) 정책 상수
// ------------------------------
const CONFIG = {
    currency: "KRW",
    periodsPerYear: 12 as const,
    rounding: "floor" as const, // floor|round|ceil
    NONTAX_ALLOWANCE: 200_000 as const, // 월 식대 비과세

    // 인적공제(기본공제) — 기본값: 본인 1명
    DEPENDENTS: 1 as const, // 필요시 2,3... 로 수정(본인 포함)

    // 사회보험(근로자 부담) — 과세되는 월 급여 기준
    social: {
        nationalPension: {
            label: "국민연금",
            rate: 0.045,                // 4.5%
            monthlyMinBase: 390_000,    // 예시 하한
            monthlyMaxBase: 5_900_000   // 예시 상한
        },
        healthInsurance: {
            label: "건강보험",
            rate: 0.03545,              // 3.545% (예시, 근로자 부담)
            longTermCare: { label: "장기요양", rateOnHealth: 0.1295 } // 건강보험료의 12.95%
        },
        employmentInsurance: {
            label: "고용보험",
            rate: 0.009                 // 0.9%
        }
    },

    // 종합소득세 — 누진공제식 (2023~2024 귀속 구간)
    tax: {
        brackets: [
            { upTo: 14_000_000, rate: 0.06, deduction: 0 },
            { upTo: 50_000_000, rate: 0.15, deduction: 840_000 },
            { upTo: 88_000_000, rate: 0.24, deduction: 6_240_000 },
            { upTo: 150_000_000, rate: 0.35, deduction: 15_360_000 },
            { upTo: 300_000_000, rate: 0.38, deduction: 37_060_000 },
            { upTo: 500_000_000, rate: 0.40, deduction: 94_060_000 },
            { upTo: 1_000_000_000, rate: 0.42, deduction: 174_060_000 },
            { upTo: Infinity, rate: 0.45, deduction: 384_060_000 }
        ],
        localOnIncomeTax: 0.10 // 지방소득세=산출 소득세의 10%
    }
} as const;

// ------------------------------
// 2) 유틸
// ------------------------------
type Rounding = "floor" | "round" | "ceil";
const round = (x: number, mode: Rounding) =>
    mode === "floor" ? Math.floor(x) : mode === "ceil" ? Math.ceil(x) : Math.round(x);
const fmt = (n: number) => n.toLocaleString("ko-KR");

// 근로소득공제(총급여 기준, 2023~2024)
export function earnedIncomeDeduction(totalSalary: number): number {
    if (totalSalary <= 5_000_000) return totalSalary * 0.70;
    if (totalSalary <= 15_000_000) return 3_500_000 + (totalSalary - 5_000_000) * 0.40;
    if (totalSalary <= 45_000_000) return 7_500_000 + (totalSalary - 15_000_000) * 0.15;
    if (totalSalary <= 100_000_000) return 12_000_000 + (totalSalary - 45_000_000) * 0.05;
    return 14_750_000 + (totalSalary - 100_000_000) * 0.02;
}

// 누진공제식 산출세액
export function progressiveTaxByQuickDeduction(annualTaxBase: number): number {
    const bracketIndex = CONFIG.tax.brackets.findIndex(b => annualTaxBase <= b.upTo)
    const bracket = CONFIG.tax.brackets[bracketIndex] || { upTo: 0, rate: 0, deduction: 0 };
    const prevBracket = CONFIG.tax.brackets[bracketIndex - 1] || { upTo: 0, rate: 0, deduction: 0 };
    return Math.max(0, (annualTaxBase - prevBracket.upTo) * bracket.rate + bracket.deduction);
}

// 근로소득세 세액공제 한도 계산 (총급여액 기준)
export function earnedIncomeTaxDeductionLimit(totalSalary: number): number {
    if (totalSalary <= 33_000_000) {
        return 740_000; // 74만원
    }
    
    if (totalSalary <= 70_000_000) {
        const deduction = 740_000 - (totalSalary - 33_000_000) * 0.008;
        return Math.max(660_000, deduction); // 최소 66만원
    }
    
    if (totalSalary <= 120_000_000) {
        const deduction = 660_000 - (totalSalary - 70_000_000) * 0.5;
        return Math.max(500_000, deduction); // 최소 50만원
    }
    
    const deduction = 500_000 - (totalSalary - 120_000_000) * 0.5;
    return Math.max(200_000, deduction); // 최소 20만원
}

// 근로소득세 세액공제 계산 (산출세액 기준)
export function earnedIncomeTaxDeduction(calculatedTax: number): number {
    if (calculatedTax <= 1_300_000) {
        return calculatedTax * 0.55; // 55%
    }
    
    return 715_000 + (calculatedTax - 1_300_000) * 0.30; // 71만5천원 + 초과분의 30%
}

// 근로소득세 세액공제 (최종 적용)
export function applyEarnedIncomeTaxDeduction(calculatedTax: number, totalSalary: number): number {
    const deductionAmount = earnedIncomeTaxDeduction(calculatedTax);
    const deductionLimit = earnedIncomeTaxDeductionLimit(totalSalary);
    
    return Math.min(deductionAmount, deductionLimit);
}

// ------------------------------
// 3) 핵심 계산
// ------------------------------
function calcNetByAnnualKRW(annualGross: number) {
    const P = CONFIG.periodsPerYear;

    // 분리: 월 총액 vs 과세되는 월 급여
    const monthlyGrossTotal = annualGross / P;
    const monthlyTaxableBase = Math.max(0, monthlyGrossTotal - CONFIG.NONTAX_ALLOWANCE);

    // (1) 사회보험 — 과세되는 월 급여 기준(상/하한 반영은 국민연금에만)
    const npBase = Math.min(
        Math.max(monthlyTaxableBase, CONFIG.social.nationalPension.monthlyMinBase),
        CONFIG.social.nationalPension.monthlyMaxBase
    );
    const np = npBase * CONFIG.social.nationalPension.rate; // 국민연금
    const hi = monthlyTaxableBase * CONFIG.social.healthInsurance.rate; // 건강보험
    const ltc = hi * CONFIG.social.healthInsurance.longTermCare.rateOnHealth; // 장기요양
    const ei = monthlyTaxableBase * CONFIG.social.employmentInsurance.rate; // 고용보험

    const monthlySocialTotal = np + hi + ltc + ei; // 사회보험 월 총액
    const annualSocialTotal = monthlySocialTotal * P;

    // (2) 과세표준 만들기
    // 총급여(= 비과세 제외 월급 × 12)
    const annualTotalSalary = monthlyTaxableBase * P;

    // 근로소득공제
    const earnedDeduction = earnedIncomeDeduction(annualTotalSalary);

    // 근로소득금액
    const earnedIncome = Math.max(0, annualTotalSalary - earnedDeduction);

    // 기본공제(인적공제) — 1인당 1,500,000원
    const basicPersonalDeduction = 1_500_000 * CONFIG.DEPENDENTS;

    // 최종 과세표준 = 근로소득금액 - 인적공제 - 사회보험(연)
    const annualTaxable = Math.max(
        0,
        earnedIncome - basicPersonalDeduction - annualSocialTotal
    );

    console.log("annualTaxable", annualTaxable);

    // (3) 소득세(누진공제식) + 지방소득세
    const incomeTax = progressiveTaxByQuickDeduction(annualTaxable);
    const localTax = Math.floor(incomeTax * CONFIG.tax.localOnIncomeTax);
    
    // 근로소득세액공제 적용
    const taxDeduction = applyEarnedIncomeTaxDeduction(incomeTax, annualTotalSalary);
    const finalIncomeTax = Math.max(0, incomeTax - taxDeduction);
    const finalLocalTax = Math.floor(finalIncomeTax * CONFIG.tax.localOnIncomeTax);

    const annualTaxTotal = finalIncomeTax + finalLocalTax;
    const monthlyTaxTotal = annualTaxTotal / P;

    // (4) 실수령 = 월 총액 - (사회보험 월) - (세금 월)
    const monthlyNetRaw = monthlyGrossTotal - monthlySocialTotal - monthlyTaxTotal;
    const annualNetRaw = monthlyNetRaw * P;

    return {
        currency: CONFIG.currency,
        gross: {
            monthlyTotal: round(monthlyGrossTotal, CONFIG.rounding),
            annual: round(annualGross, CONFIG.rounding)
        },
        nonTax: {
            monthly: CONFIG.NONTAX_ALLOWANCE,
            annual: CONFIG.NONTAX_ALLOWANCE * P
        },
        taxableBase: {
            monthly: round(monthlyTaxableBase, CONFIG.rounding)
        },
        deductions: {
            monthly: {
                [CONFIG.social.nationalPension.label]: round(np, CONFIG.rounding),
                [CONFIG.social.healthInsurance.label]: round(hi, CONFIG.rounding),
                [CONFIG.social.healthInsurance.longTermCare.label]: round(ltc, CONFIG.rounding),
                [CONFIG.social.employmentInsurance.label]: round(ei, CONFIG.rounding)
            },
            monthlySocial: round(monthlySocialTotal, CONFIG.rounding),
            monthlyTaxes: round(monthlyTaxTotal, CONFIG.rounding),
            monthlyTotal: round(monthlySocialTotal + monthlyTaxTotal, CONFIG.rounding),
            annualSocial: round(annualSocialTotal, CONFIG.rounding),
            annualTaxes: round(annualTaxTotal, CONFIG.rounding)
        },
        net: {
            monthly: round(monthlyNetRaw, CONFIG.rounding),
            annual: round(annualNetRaw, CONFIG.rounding)
        },
        debug: {
            annualTotalSalary: round(annualTotalSalary, CONFIG.rounding),
            earnedDeduction: round(earnedDeduction, CONFIG.rounding),
            earnedIncome: round(earnedIncome, CONFIG.rounding),
            basicPersonalDeduction: round(basicPersonalDeduction, CONFIG.rounding),
            annualTaxable: round(annualTaxable, CONFIG.rounding),
            annualIncomeTax: round(incomeTax, CONFIG.rounding),
            annualLocalTax: round(localTax, CONFIG.rounding),
            taxDeduction: round(taxDeduction, CONFIG.rounding),
            finalIncomeTax: round(finalIncomeTax, CONFIG.rounding),
            finalLocalTax: round(finalLocalTax, CONFIG.rounding)
        }
    };
}

// ------------------------------
// 4) CLI 입출력
// ------------------------------
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));

(async () => {
    console.log("======================================");
    console.log("     KR Actual Salary (간편 계산기)     ");
    console.log("======================================");
    const input = (await ask('연봉을 "만원 단위"로 입력해주세요 (예: 5000) > ')).trim();
    rl.close();

    if (!/^\d+$/.test(input)) {
        console.error("정수만 입력해주세요. 예: 5000 (=> 5,000만원)");
        process.exit(1);
    }

    const annualKRW = parseInt(input, 10) * 10_000;
    const r = calcNetByAnnualKRW(annualKRW);

    console.log("--------------------------------------");
    console.log(`연봉(총액): ${fmt(r.gross.annual)}원`);
    console.log(`월 총액   : ${fmt(r.gross.monthlyTotal)}원`);
    console.log(`비과세(월): ${fmt(r.nonTax.monthly)}원`);
    console.log(`과세급여(월): ${fmt(r.taxableBase.monthly)}원`);
    console.log("--------------------------------------");
    console.log("공제(월):");
    Object.entries(r.deductions.monthly).forEach(([k, v]) =>
        console.log(`  - ${k}: ${fmt(v as number)}원`)
    );
    console.log(`  - (소계) 사회보험 합계: ${fmt(r.deductions.monthlySocial)}원`);
    console.log(`  - (소계) 소득세/지방세: ${fmt(r.deductions.monthlyTaxes)}원`);
    console.log(`  - (소계) 공제 합계   : ${fmt(r.deductions.monthlyTotal)}원`);
    console.log("--------------------------------------");
    console.log(`월 실수령액: ${fmt(r.net.monthly)}원`);
    console.log(`연 실수령액: ${fmt(r.net.annual)}원`);
    console.log("--------------------------------------");
})();