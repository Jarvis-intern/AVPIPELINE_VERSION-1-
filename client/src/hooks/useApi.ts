import { toast } from "sonner";
import { useState } from "react";

import { APIError } from "@/services/errors";

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

type ApiCall<T> = () => Promise<T>;
type SuccessCallback<T> = (data: T) => void;
type ErrorCallback = (error: Error | APIError) => void;

export function useApi<T>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = async (
    apiCall: ApiCall<T>,
    onSuccess?: SuccessCallback<T>,
    onError?: ErrorCallback
  ) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await apiCall();
      setState({ data, loading: false, error: null });
      onSuccess?.(data);
      return data;
    } catch (error) {
      const errorMessage =
        error instanceof APIError
          ? error.message
          : "An unexpected error occurred";

      setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
      // Default error callback which can be overridden and it should show a toast in defaul case of error
      if (onError) {
        onError(error instanceof Error ? error : new Error(errorMessage));
      } else {
        toast.error(errorMessage);
      }

      throw error;
    }
  };

  const reset = () => {
    setState({ data: null, loading: false, error: null });
  };

  return {
    ...state,
    execute,
    reset,
  };
}
