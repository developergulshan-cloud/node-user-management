import { Request, Response, NextFunction, RequestHandler } from 'express';
import csrf from 'csurf';

/**
 * Type augmentation notes:
 * - `req.isAuthenticated()` and `req.user` come from Passport.js.
 *   Install `@types/passport` and `@types/express-session`, and Passport's
 *   own d.ts already augments `Express.Request` with `isAuthenticated()`
 *   and `user`. If `req.user` isn't typed the way you need, extend it like:
 *
 *   declare global {
 *     namespace Express {
 *       interface User {
 *         id: number;
 *         is_active: boolean;
 *       }
 *     }
 *   }
 *
 * - `req.csrfToken()` is added by the `csurf` middleware at runtime.
 *   @types/csurf declares it on `Request`, so no extra augmentation is
 *   needed as long as that package is installed.
 */

interface ApiResponse {
    success: boolean;
    message: string;
    error?: string;
}

/**
 * Middleware to check if user is authenticated
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({
        success: false,
        message: 'Authentication required'
    } as ApiResponse);
};

/**
 * Middleware to check if user is not authenticated (for login/register pages)
 */
export const isNotAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.status(400).json({
        success: false,
        message: 'Already authenticated'
    } as ApiResponse);
};

/**
 * Middleware to check if user account is active
 */
export const isActive = (req: Request, res: Response, next: NextFunction): void => {
    if (req.user && (req.user as { is_active?: boolean }).is_active) {
        return next();
    }
    res.status(403).json({
        success: false,
        message: 'Account is deactivated'
    } as ApiResponse);
};

/**
 * CSRF Protection middleware
 * Uses double submit cookie pattern
 */
export const csrfProtection: RequestHandler = csrf({
    cookie: {
        httpOnly: true,
        secure: false, // HTTPS only in production
        sameSite: 'strict',
        maxAge: 3600000 // 1 hour
    }
});

/**
 * Middleware to add CSRF token to response
 */
export const addCsrfToken = (req: Request, res: Response, next: NextFunction): void => {
    res.locals.csrfToken = req.csrfToken();
    next();
};

/**
 * Custom error handler for CSRF errors
 */
interface CsrfError extends Error {
    code?: string;
}

export const csrfErrorHandler = (
    err: CsrfError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (err.code === 'EBADCSRFTOKEN') {
        res.status(403).json({
            success: false,
            message: 'Invalid CSRF token',
            error: 'CSRF_ERROR'
        } as ApiResponse);
        return;
    }
    next(err);
};

/**
 * Rate limiting middleware (simple implementation)
 */
export const createRateLimiter = (
    maxRequests: number = 60,
    windowMs: number = 15 * 60 * 1000
): RequestHandler => {
    const requests = new Map<string, number[]>();

    return (req: Request, res: Response, next: NextFunction): void => {
        const identifier = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();

        if (!requests.has(identifier)) {
            requests.set(identifier, []);
        }

        const userRequests = requests.get(identifier) as number[];
        const recentRequests = userRequests.filter((time) => now - time < windowMs);

        if (recentRequests.length >= maxRequests) {
            res.status(429).json({
                success: false,
                message: 'Too many requests, please try again later'
            } as ApiResponse);
            return;
        }

        recentRequests.push(now);
        requests.set(identifier, recentRequests);

        // Clean up old entries periodically
        if (Math.random() < 0.01) {
            for (const [key, times] of requests.entries()) {
                const validTimes = times.filter((time) => now - time < windowMs);
                if (validTimes.length === 0) {
                    requests.delete(key);
                } else {
                    requests.set(key, validTimes);
                }
            }
        }

        next();
    };
};

/**
 * Sanitize user input middleware
 */
type Sanitizable = string | number | boolean | null | undefined | Sanitizable[] | { [key: string]: Sanitizable };

export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
    // Basic XSS prevention
    const sanitize = (obj: Sanitizable): Sanitizable => {
        if (typeof obj === 'string') {
            return obj
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
        }
        if (typeof obj === 'object' && obj !== null) {
            if (Array.isArray(obj)) {
                return obj.map(sanitize);
            }
            const result: { [key: string]: Sanitizable } = {};
            for (const key in obj) {
                result[key] = sanitize(obj[key]);
            }
            return result;
        }
        return obj;
    };

    if (req.body) {
        const sanitized = sanitize({ ...req.body });
        (req as Request & { sanitizedBody?: Sanitizable }).sanitizedBody = sanitized;
        req.body = sanitized as any;
    }

    next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): boolean => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
};

export default {
    isAuthenticated,
    isNotAuthenticated,
    isActive,
    csrfProtection,
    addCsrfToken,
    csrfErrorHandler,
    createRateLimiter,
    sanitizeInput,
    securityHeaders,
    validateEmail,
    validatePassword
};