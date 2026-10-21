import { GraphQLClient, gql } from 'graphql-request';
import { SECTION_DEFINITIONS } from '../config/templates';
import { getItemsFromJsonData } from '../utils/dataUtils';
import { TemplateType, OnboardingStep } from './useOnboardingState';

const GRAPHQL_ENDPOINT = '/api/graphql';

interface OnboardingApiProps {
  selectedTemplate: TemplateType;
  currentJsonData: any;
  completedItems: Record<string, string[]>;
  setProgress: (message: string) => void;
  setItemLoading: (type: string, item: string) => void;
  setItemCompleted: (type: string, item: string) => void;
  setItemError: (type: string, item: string, errorMessage: string) => void;
  setStep: (step: OnboardingStep) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  resetOnboardingState: () => void;
}

type RunSalonOnboardingResult = {
  success: boolean;
  completed: boolean;
  created: number;
  reused: number;
  locationId: string | null;
  error: string | null;
};

const RUN_SALON_ONBOARDING = gql`
  mutation RunSalonOnboarding($seed: JSON) {
    runSalonOnboarding(seed: $seed) {
      success
      completed
      created
      reused
      locationId
      error
    }
  }
`;

function errorMessage(error: any) {
  if (error?.response?.errors?.length) {
    return error.response.errors.map((item: any) => item.message || JSON.stringify(item)).join('\n');
  }
  return error?.message || 'Salon setup failed';
}

export function useOnboardingApi({
  currentJsonData,
  setProgress,
  setItemLoading,
  setItemCompleted,
  setStep,
  setError,
  setIsLoading,
  resetOnboardingState,
}: OnboardingApiProps) {
  const runOnboarding = async () => {
    setIsLoading(true);
    setError(null);
    resetOnboardingState();
    setStep('progress');
    setProgress('Applying salon setup in one secure transaction...');

    try {
      for (const section of SECTION_DEFINITIONS) {
        for (const item of getItemsFromJsonData(currentJsonData, section.type)) {
          setItemLoading(section.type, item);
        }
      }

      const client = new GraphQLClient(GRAPHQL_ENDPOINT, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await client.request<{ runSalonOnboarding: RunSalonOnboardingResult }>(
        RUN_SALON_ONBOARDING,
        { seed: currentJsonData },
      );
      const result = response.runSalonOnboarding;
      if (!result.success || !result.completed) throw new Error(result.error || 'Salon setup did not complete');

      for (const section of SECTION_DEFINITIONS) {
        for (const item of getItemsFromJsonData(currentJsonData, section.type)) {
          setItemCompleted(section.type, item);
        }
      }
      setProgress(`Salon setup complete · ${result.created} created, ${result.reused} reused.`);
      setStep('done');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return { runOnboarding };
}
