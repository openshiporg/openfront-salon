import React, { useState } from 'react';
import { ArrowLeft, Clipboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DataCard } from './DataCard';
import seedData from '@/features/platform/onboarding/lib/seed.json';

interface CustomSetupStepsProps {
  currentJson?: any;
  onJsonUpdate?: (newJson: any) => void;
  onBack?: () => void;
}

function useCopyToClipboard(): [string | null, (text: string) => Promise<boolean>] {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = React.useCallback(async (text: string) => {
    if (!navigator?.clipboard) {
      console.warn('Clipboard not supported');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      return true;
    } catch (error) {
      console.warn('Copy failed', error);
      setCopiedText(null);
      return false;
    }
  }, []);

  return [copiedText, copy];
}

const requiredKeys = [
  'resources',
  'services',
  'stylists',
  'scheduleBlocks',
  'clients',
  'memberships',
  'appointments',
  'gallery',
  'paymentProviders',
];

function getCompleteSetupJson() {
  return seedData;
}

export function CustomSetupSteps({ currentJson, onJsonUpdate = () => {}, onBack }: CustomSetupStepsProps) {
  const [, copy] = useCopyToClipboard();
  const [copiedItems, setCopiedItems] = useState<Record<string, boolean>>({});
  const [customJson, setCustomJson] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [jsonApplied, setJsonApplied] = useState(false);

  const completeJson = currentJson || getCompleteSetupJson();

  const copyToClipboard = async (text: string, itemKey: string) => {
    const success = await copy(text);
    if (success) {
      setCopiedItems((prev) => ({ ...prev, [itemKey]: true }));
      setTimeout(() => {
        setCopiedItems((prev) => ({ ...prev, [itemKey]: false }));
      }, 2000);
    }
  };

  const generateAIPrompt = () => {
    return `I need help customizing my salon setup seed JSON. The JSON includes storefront identity and theme, resources, services, artist schedules, client records, memberships, sample appointments, and relative /images paths for services, artists, and the gallery.

First summarize what this seed currently contains. Then ask what I want to change about:
- services, prices, durations, deposits, and required resources
- artist roles, specialties, portraits, and weekly schedules
- clients, preferences, and memberships
- service and gallery imagePath values under /images/
- sample appointments and payment-provider configuration

After I answer, return one complete valid JSON object with the same top-level keys so I can paste it back into the salon setup dialog.`;
  };

  const validateAndApplyJson = () => {
    try {
      const parsed = JSON.parse(customJson);
      const missingKeys = requiredKeys.filter((key) => {
        if (key === 'salonInfo') return !parsed[key] || typeof parsed[key] !== 'object';
        return !parsed[key] || !Array.isArray(parsed[key]);
      });

      if (missingKeys.length > 0) {
        setJsonError(`Missing required keys: ${missingKeys.join(', ')}`);
        return;
      }

      onJsonUpdate(parsed);
      setJsonApplied(true);
      setJsonError('');
    } catch (error) {
      setJsonError('Invalid JSON format. Please check your syntax.');
    }
  };

  const steps = [
    {
      number: 1,
      title: 'Copy Base Configuration',
      description: 'Start with the complete salon setup seed JSON.',
      content: (
        <DataCard
          title="Onboarding Data"
          content={JSON.stringify(completeJson, null, 2)}
          onCopy={copyToClipboard}
          copied={copiedItems.json || false}
          copyKey="json"
        />
      ),
    },
    {
      number: 2,
      title: 'Copy AI Customization Prompt',
      description: 'Use this prompt with any AI assistant to adapt the seed to your salon.',
      content: (
        <DataCard
          title="AI Prompt"
          content={generateAIPrompt()}
          onCopy={copyToClipboard}
          copied={copiedItems.prompt || false}
          copyKey="prompt"
        />
      ),
    },
    {
      number: 3,
      title: 'Customize Your Seed',
      description: 'Update services, artists, schedules, memberships, images, or sample appointments.',
      content: (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Keep names consistent across relationships. For example, an appointment service name must match a service in the services array, and a staff specialization must match a service name.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• Use prices in cents for service.price and service variants.</li>
            <li>• Use integer cents for every monetary field, including memberships, packages, and retail products.</li>
            <li>• Use dayOfWeek 0-6 for recurring staff schedules, where Sunday is 0.</li>
          </ul>
        </div>
      ),
    },
    {
      number: 4,
      title: 'Paste Custom JSON',
      description: 'Paste the updated JSON object and apply it before confirming setup.',
      content: (
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
            <span className="text-sm font-medium text-muted-foreground">Custom Onboarding Data</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  setCustomJson(text);
                  setJsonError('');
                } catch (error) {
                  console.error('Failed to paste:', error);
                }
              }}
              className="h-6 w-6 p-0 hover:bg-background/80"
            >
              <Clipboard className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
          <div className="bg-background">
            <Textarea
              placeholder="Paste your customized JSON configuration here..."
              value={customJson}
              onChange={(event) => {
                setCustomJson(event.target.value);
                setJsonError('');
              }}
              className="min-h-[220px] font-mono text-xs resize-none border-0 bg-transparent focus:outline-none p-4 rounded-none"
            />
          </div>
          {jsonError && (
            <div className="px-4 pb-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2">
                <p className="text-xs text-destructive">{jsonError}</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-end px-4 py-2 bg-muted border-t">
            <Button size="sm" onClick={validateAndApplyJson} disabled={!customJson.trim()}>
              Apply Configuration
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {jsonApplied && onBack && (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setJsonApplied(false);
              onBack();
            }}
            className="h-8 px-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Custom Setup
          </Button>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium">Custom Setup Configuration</Label>
        <p className="text-xs text-muted-foreground">
          Follow these steps to create a personalized salon setup using AI assistance.
        </p>
      </div>

      <div className="space-y-0">
        {steps.map((step, index) => (
          <div key={step.number} className="relative">
            {index < steps.length - 1 && (
              <div className="absolute left-3 top-3 bottom-0 w-[1px] bg-border" />
            )}
            <div className="flex items-center space-x-3 mb-2 relative">
              <div className="inline-flex size-6 items-center justify-center rounded-sm border border-border bg-background text-sm text-foreground shadow-sm z-10">
                {step.number}
              </div>
              <Label className="text-sm font-medium text-foreground">{step.title}</Label>
            </div>
            <div className="pl-9">
              <div className="pb-6">
                <p className="text-xs text-muted-foreground mb-3">{step.description}</p>
                {step.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
