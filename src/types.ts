/**
 * 한국 연봉 실수령액 계산기 타입 정의
 */

// 정책 상수 타입
export interface SocialInsuranceConfig {
  nationalPension: {
    label: string;
    rate: number;
    monthlyMinBase: number;
    monthlyMaxBase: number;
  };
  healthInsurance: {
    label: string;
    rate: number;
    longTermCare: {
      label: string;
      rateOnHealth: number;
    };
  };
  employmentInsurance: {
    label: string;
    rate: number;
  };
}

export interface TaxBracket {
  upTo: number;
  rate: number;
  deduction: number;
}

export interface TaxConfig {
  brackets: TaxBracket[];
  localOnIncomeTax: number;
}

export interface SalaryCalculationConfig {
  currency: string;
  periodsPerYear: 12;
  rounding: 'floor' | 'round' | 'ceil';
  NONTAX_ALLOWANCE: number;
  DEPENDENTS: number;
  social: SocialInsuranceConfig;
  tax: TaxConfig;
}

// 계산 결과 타입
export interface GrossAmount {
  monthlyTotal: number;
  annual: number;
}

export interface NonTaxAmount {
  monthly: number;
  annual: number;
}

export interface TaxableBase {
  monthly: number;
}

export interface MonthlyDeductions {
  [key: string]: number;
}

export interface Deductions {
  monthly: MonthlyDeductions;
  monthlySocial: number;
  monthlyTaxes: number;
  monthlyTotal: number;
  annualSocial: number;
  annualTaxes: number;
}

export interface NetAmount {
  monthly: number;
  annual: number;
}

export interface DebugInfo {
  annualTotalSalary: number;
  earnedDeduction: number;
  earnedIncome: number;
  basicPersonalDeduction: number;
  annualTaxable: number;
  annualIncomeTax: number;
  annualLocalTax: number;
  taxDeduction: number;
  finalIncomeTax: number;
  finalLocalTax: number;
}

export interface SalaryCalculationResult {
  currency: string;
  gross: GrossAmount;
  nonTax: NonTaxAmount;
  taxableBase: TaxableBase;
  deductions: Deductions;
  net: NetAmount;
  debug: DebugInfo;
}

// 유틸리티 타입
export type RoundingMode = 'floor' | 'round' | 'ceil';

// 함수 시그니처 타입
export type SalaryCalculator = (annualGross: number) => SalaryCalculationResult;
export type RoundingFunction = (x: number, mode: RoundingMode) => number;
export type FormatterFunction = (n: number) => string;
