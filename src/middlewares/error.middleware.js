import { ApiError } from "../utils/ApiError.js";

const errorHandler = (err, req, res, _next) => {
    console.error("ERROR LOG:", err);

    const error = err instanceof ApiError
        ? err
        : new ApiError(
            err.statusCode || 500,
            err.message || "Something went wrong on the server",
            err.errors || []
        );

    const prefersJson = req.path.startsWith("/api") || req.accepts(["json", "html", "text"]) === "json";

    if (prefersJson) {
        return res.status(error.statusCode).json({
            success: false,
            statusCode: error.statusCode,
            message: error.message,
            errors: error.errors,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        });
    }

    return res
        .status(error.statusCode)
        .send(`Error ${error.statusCode}: ${error.message}`);
};

export { errorHandler };