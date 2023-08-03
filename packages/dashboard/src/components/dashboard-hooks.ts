import { useCallback, useMemo, useState } from 'react';

export type URLParamsValue<KEY extends string> = Record<KEY, string | undefined>;

export const useUrlParams = <KEY extends string>(
    defaults: URLParamsValue<KEY>,
): [URLParamsValue<KEY>, (t: URLParamsValue<KEY>) => void] => {
    const initialValus = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        return Object.entries(defaults).reduce((acc, [key, val]) => {
            acc[key as KEY] = (params.get(key) || val) as URLParamsValue<KEY>[KEY];
            return acc;
        }, {} as URLParamsValue<KEY>);
    }, [defaults]);
    const [values, setValues] = useState(initialValus);
    const set = useCallback(
        (values: URLParamsValue<KEY>) => {
            const url = new URL(window.location.href);
            for (const key of Object.keys(defaults)) {
                const value = values[key as KEY];
                if (value) {
                    url.searchParams.set(key, value);
                } else {
                    url.searchParams.delete(key);
                }
            }
            window.history.pushState(
                {},
                Object.entries(values).reduce((acc, [key, val]) => {
                    return `${acc} ${key}:${(val as string) || '*unselected*'}`;
                }, 'Dashboard>'),
                url.toString(),
            );
            setValues(values);
        },
        [defaults],
    );
    return [values, set];
};
