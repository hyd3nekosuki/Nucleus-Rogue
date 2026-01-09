// Fix: Added React import to resolve missing namespace error
import React, { useCallback } from 'react';
import { NuclideData } from '../types';
import { DiscoveryContext } from '../engine/stateTransitions';

/**
 * Unified Atomic Dispatcher Hook
 * 
 * Provides a standardized interface for all actions that result in a nuclide transformation.
 * By routing all transformations through dispatchDiscovery, we guarantee that the 
 * physical state transitions (level-up, barrier check, and history logging) 
 * defined in the reducer are applied consistently, regardless of how the discovery occurred.
 */
export const useAtomicDispatcher = (dispatch: React.Dispatch<any>) => {
    
    /**
     * Trigger a standardized discovery event.
     * This method maps the high-level game event to the DISCOVER_NUCLIDE action.
     * 
     * @param nextNuclide The target nuclide data being transitioned to.
     * @param context Metadata about the discovery (method, previous coordinates, score, etc).
     */
    const dispatchDiscovery = useCallback((
        nextNuclide: NuclideData, 
        context: DiscoveryContext
    ) => {
        dispatch({
            type: 'DISCOVER_NUCLIDE',
            payload: {
                nextNuclide,
                method: context.method,
                pz: context.pz,
                pa: context.pa,
                addedScore: context.addedScore,
                chargesUsed: context.chargesUsed,
                inducedDecayMode: context.inducedDecayMode
            }
        });
    }, [dispatch]);

    return {
        dispatchDiscovery
    };
};