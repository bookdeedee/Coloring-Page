import React, { useState, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";

const App: React.FC = () => {
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lineThickness, setLineThickness] = useState<string>('2'); // 1: thin, 2: normal, 3: thick
    const [removeGrays, setRemoveGrays] = useState<boolean>(true);
    const [upscaleImage, setUpscaleImage] = useState<boolean>(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const lineThicknessLabels: { [key: string]: string } = {
        '1': 'Thin',
        '2': 'Normal',
        '3': 'Bold',
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setOriginalImage(reader.result as string);
                setProcessedImage(null);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileUpload = () => fileInputRef.current?.click();
    const triggerCamera = () => cameraInputRef.current?.click();

    const processImage = useCallback(async () => {
        if (!originalImage) {
            setError("Please upload an image first.");
            return;
        }

        setIsLoading(true);
        setError(null);
        // Do not clear the previous image, so the user can see the before/after
        // setProcessedImage(null); 

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            
            const base64Data = originalImage.split(',')[1];
            const mimeType = originalImage.split(';')[0].split(':')[1];

            const lineThicknessMap: { [key: string]: string } = {
                '1': 'very thin, delicate lines, like a fine-point pen drawing',
                '2': 'clear, medium-thickness lines, standard for a coloring book',
                '3': 'very bold, thick lines, like a thick marker drawing',
            };
            const lineDescription = lineThicknessMap[lineThickness];

            let prompt = `Convert this image into a black and white line drawing suitable for a coloring book page. The lines should be ${lineDescription}.`;
            if (removeGrays) {
                prompt += ' The final image must be strictly black and white, with all shades of gray and color completely removed. The background should be pure white.';
            }
            if (upscaleImage) {
                prompt += ' Additionally, upscale the image to a higher resolution, making the lines sharper and more detailed, suitable for high-quality printing.';
            }


            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        { inlineData: { data: base64Data, mimeType } },
                        { text: prompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });
            
            let foundImage = false;
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    const newImageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    setProcessedImage(newImageData);
                    foundImage = true;
                    break;
                }
            }

            if (!foundImage) {
                 throw new Error("The AI did not return an image. Please try again.");
            }

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "An unknown error occurred while processing the image.");
        } finally {
            setIsLoading(false);
        }
    }, [originalImage, lineThickness, removeGrays, upscaleImage]);

    const handleShare = async () => {
        if (!processedImage) {
            setError("No processed image to share.");
            return;
        }

        if (!navigator.share) {
            setError("Web Share API is not available on your browser.");
            return;
        }

        try {
            // Convert data URL to Blob to create a File object
            const response = await fetch(processedImage);
            const blob = await response.blob();
            const file = new File([blob], 'coloring-page.png', { type: blob.type });

            // Use the Web Share API
            await navigator.share({
                title: 'My Coloring Page',
                text: 'Check out this coloring page I made!',
                files: [file],
            });
        } catch (err: any) {
             // Avoid showing an error if the user simply cancels the share dialog
            if (err.name !== 'AbortError') {
                 console.error('Share failed:', err);
                 setError(err instanceof Error ? err.message : "Could not share the image.");
            }
        }
    };

    const startOver = () => {
        setOriginalImage(null);
        setProcessedImage(null);
        setError(null);
        setIsLoading(false);
        if(fileInputRef.current) fileInputRef.current.value = "";
        if(cameraInputRef.current) cameraInputRef.current.value = "";
    };

    return (
        <div className="container">
             <header>
                <h1>Coloring Page Creator</h1>
                <p>Turn any photo into a beautiful coloring page with AI.</p>
            </header>
            <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="user"
                onChange={handleImageChange}
                style={{ display: 'none' }}
                aria-hidden="true"
            />
            <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
                aria-hidden="true"
            />
            
            <div className="main-content">
                <div className="image-panel">
                    <h3>Original Image</h3>
                    <div className="image-container">
                       {originalImage ? (
                            <img src={originalImage} alt="Original user upload" />
                       ) : (
                            <div className="placeholder placeholder-upload" onClick={triggerFileUpload} role="button" tabIndex={0} onKeyPress={(e) => e.key === 'Enter' && triggerFileUpload()}>
                                 <div className="button-group">
                                    <button onClick={(e) => { e.stopPropagation(); triggerCamera(); }} className="btn btn-primary" aria-label="Take a photo">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                                        Take Photo
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); triggerFileUpload(); }} className="btn btn-secondary" aria-label="Upload an image">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                        Upload Image
                                    </button>
                                </div>
                                <p className="placeholder-text">Click or drag a file here</p>
                            </div>
                       )}
                    </div>
                </div>
                <div className="image-panel">
                    <h3>Coloring Page</h3>
                    <div className="image-container">
                        {isLoading && (
                            <div className="loading-overlay">
                                <div className="spinner"></div>
                            </div>
                        )}
                        {processedImage ? (
                            <img src={processedImage} alt="Processed coloring page" />
                        ) : (
                            <div className="placeholder">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z"></path><path d="M12 22.69V12"></path><path d="m9.6 15.11 2.4-2.4 2.4 2.4"></path><path d="M14.5 4.5 12 2 9.5 4.5"></path><path d="M4.22 14.22 2 12l2.22-2.22"></path><path d="M19.78 14.22 22 12l-2.22-2.22"></path></svg>
                                <p className="placeholder-text">Your generated coloring page will appear here.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {originalImage && (
                <div className="editor-controls">
                    <div className="controls">
                        <div className="control-group">
                            <label htmlFor="line-thickness">Line Thickness: <strong>{lineThicknessLabels[lineThickness]}</strong></label>
                            <input
                                id="line-thickness"
                                type="range"
                                min="1"
                                max="3"
                                step="1"
                                value={lineThickness}
                                onChange={(e) => setLineThickness(e.target.value)}
                                aria-label="Adjust line thickness"
                            />
                        </div>
                        <div className="checkbox-group">
                            <input
                                id="remove-grays"
                                type="checkbox"
                                checked={removeGrays}
                                onChange={(e) => setRemoveGrays(e.target.checked)}
                                aria-label="Remove gray shades"
                            />
                            <label htmlFor="remove-grays">Crisp B&W (No Grays)</label>
                        </div>
                         <div className="checkbox-group">
                            <input
                                id="upscale-image"
                                type="checkbox"
                                checked={upscaleImage}
                                onChange={(e) => setUpscaleImage(e.target.checked)}
                                aria-label="Upscale image for more detail"
                            />
                            <label htmlFor="upscale-image">Upscale for Detail</label>
                        </div>
                    </div>

                    {error && <div className="error-message" role="alert">{error}</div>}

                    <div className="action-buttons">
                        <button onClick={startOver} className="btn btn-secondary">Start Over</button>
                        <button onClick={processImage} className="btn btn-primary" disabled={isLoading || !originalImage} aria-live="polite">
                            {isLoading ? "Creating..." : (processedImage ? "Update Coloring Page" : "Create Coloring Page")}
                        </button>
                        {processedImage && <a href={processedImage} download="coloring-page.png" className="btn btn-success">Download</a>}
                        {processedImage && navigator.share && <button onClick={handleShare} className="btn btn-info">Share</button>}
                    </div>
                </div>
            )}
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);