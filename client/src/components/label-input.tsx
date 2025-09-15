import { Info, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";

interface LabelInputProps {
  label: string;
  value: string;
  type?:
    | "text"
    | "number"
    | "email"
    | "password"
    | "date"
    | "time"
    | "url"
    | "select"
    | "textarea";
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  helpText?: string;
  readOnly?: boolean;
  isLoading?: boolean;
}

export const LabelInput = ({
  label,
  value,
  type = "text",
  onChange,
  placeholder,
  required = false,
  options,
  helpText,
  readOnly = false,
  isLoading = false,
}: LabelInputProps) => {
  const labelId = `label-${label.toLowerCase().split(" ").join("-")}`;

  return (
    <div>
      <Label
        htmlFor={labelId}
        className="text-sm font-medium flex items-center"
      >
        {label}
        {required && <span className="text-red-500">*</span>}
        {helpText && (
          <HoverCard>
            <HoverCardTrigger>
              <Info className="size-3 ml-2" />
            </HoverCardTrigger>
            <HoverCardContent className="text-xs py-2 px-3">
              {helpText}
            </HoverCardContent>
          </HoverCard>
        )}
      </Label>
      {type === "select" ? (
        <Select value={value} onValueChange={(value) => onChange(value)}>
          <SelectTrigger className="mt-1.5">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {isLoading ? (
              <SelectItem value="loading">
                <Loader2 className="size-4 animate-spin mx-auto" />
              </SelectItem>
            ) : (
              options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      ) : type === "textarea" ? (
        <Textarea
          id={labelId}
          placeholder={placeholder}
          className="mt-1.5 h-[114px] resize-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={labelId}
          type={type}
          placeholder={placeholder}
          className="mt-1.5"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
        />
      )}
    </div>
  );
};
