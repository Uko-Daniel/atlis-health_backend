export interface PaginationOptions {
    page?: number;
    limit?: number;
}

export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/**
 * Calculates skip/take for Prisma and returns pagination metadata
 */
export function paginate<T>(data: T[], total: number, page = 1, limit = 50): PaginatedResult<T> {
    return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

export function getSkipTake(page = 1, limit = 50) {
    const take = limit;
    const skip = (page - 1) * limit;
    return { skip, take };
}