export class Formatter {
    static currency(value: number, decimals = 2): string {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(value);
    }
}
