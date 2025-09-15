import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, FolderOpen, Info } from 'lucide-react'

export function EmlConverter() {
  const [folderPath, setFolderPath] = useState('')
  
  // Placeholder for folder selection
  const handleFolderSelect = () => {
    console.log('Folder selection not implemented yet')
  }
  
  return (
    <Card className="w-full shadow-sm border-gray-200">
      <CardHeader className="border-b border-gray-200 bg-gray-50">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Mail className="h-5 w-5 text-gray-600" />
          EML File Converter
        </CardTitle>
        <CardDescription className="text-gray-600">
          Convert email files (.eml) to HTML with attachments
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {/* Folder Path Input */}
        <div className="space-y-2">
          <Label htmlFor="folder-path" className="text-gray-700">EML Folder Location</Label>
          <div className="flex gap-2">
            <Input 
              id="folder-path"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="Enter folder path containing EML files"
              className="flex-1"
            />
            <Button variant="outline" onClick={handleFolderSelect}>
              <FolderOpen className="h-4 w-4 mr-2" />
              Browse
            </Button>
          </div>
        </div>
        
        {/* Placeholder Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Development Mode</AlertTitle>
            <AlertDescription>
            EML conversion functionality will be implemented in a later phase. 
            This is currently just a UI placeholder.
            </AlertDescription>
          </Alert>
      </CardContent>
      
      <CardFooter className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-4">
        <Button variant="outline" disabled>Analyze Folder</Button>
        <Button disabled>Start Conversion</Button>
      </CardFooter>
    </Card>
  )
} 