import { ApiError } from "../utils/ApiError.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

const errorHandler = (err, req, res, next) => {
    console.error("ERROR LOG: ", err);

    // If it's already an ApiError, use it, otherwise create a new ApiError
    const error = err instanceof ApiError 
        ? err 
        : new ApiError(
            err.statusCode || 500, 
            err.message || "Something went wrong on the server",
            err.errors || []
        );

    // Determine if the request is for HTML
    const acceptsHtml = req.accepts(['html', 'json', 'text']) === 'html';
    
    // Check if we have the error template
    const errorViewPath = path.join(rootDir, 'views', 'pages', 'error.ejs');
    const hasErrorView = fs.existsSync(errorViewPath);
    
    if (acceptsHtml && hasErrorView) {
        // Render error page for HTML requests
        return res.status(error.statusCode).render('pages/error', {
            title: `Error ${error.statusCode} - FitSync`,
            statusCode: error.statusCode,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } else if (acceptsHtml) {
        // Fallback simple HTML error if template doesn't exist
        return res.status(error.statusCode).send(`
            <html>
                <head>
                    <title>Error ${error.statusCode}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 50px; text-align: center; }
                        .error-container { max-width: 600px; margin: 0 auto; }
                        .error-code { font-size: 72px; color: #e50914; margin: 0; }
                        .error-message { margin-top: 20px; }
                        .back-link { margin-top: 30px; display: inline-block; }
                    </style>
                </head>
                <body>
                    <div class="error-container">
                        <h1 class="error-code">${error.statusCode}</h1>
                        <div class="error-message">${error.message}</div>
                        <a class="back-link" href="/">Return to Home</a>
                    </div>
                </body>
            </html>
        `);
    } else {
        // JSON response for API requests
        return res.status(error.statusCode).json({
            success: false,
            statusCode: error.statusCode,
            message: error.message,
            errors: error.errors,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

export { errorHandler }; 