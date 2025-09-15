import { useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Home } from 'lucide-react';

export function ErrorBoundary() {
  const error = useRouteError() as any;
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-red-100">
        <CardHeader className="bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-red-700">Application Error</CardTitle>
          </div>
          <CardDescription>
            {error?.status === 404 
              ? "The page you're looking for doesn't exist."
              : "Something went wrong with the application."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="p-4 bg-slate-100 rounded-md border border-slate-200">
              <p className="text-sm font-medium text-slate-700">Error Details:</p>
              <p className="text-sm text-slate-600 mt-1">
                {error?.statusText || error?.message || "Unknown error occurred"}
              </p>
              {error?.status && (
                <p className="text-xs text-slate-500 mt-2">
                  Status: {error.status}
                </p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t border-slate-200 pt-4">
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
          <Button 
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-1.5"
          >
            <Home className="h-4 w-4" />
            Return Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
