import React, { createContext, useContext, useReducer } from 'react';

export interface AppStateType {
  user: any;
  token: string | null;
  wallet: { otaCoinBalancePaise: number; rezCoinBalancePaise: number };
  search: { city: string; checkin: string; checkout: string; rooms: number; guests: number };
}

const initialState: AppStateType = {
  user: null,
  token: null,
  wallet: { otaCoinBalancePaise: 0, rezCoinBalancePaise: 0 },
  search: { city: 'Bangalore', checkin: '', checkout: '', rooms: 1, guests: 2 },
};

type Action =
  | { type: 'SET_USER'; payload: any }
  | { type: 'SET_TOKEN'; payload: string | null }
  | { type: 'SET_WALLET'; payload: { otaCoinBalancePaise: number; rezCoinBalancePaise: number } }
  | { type: 'SET_SEARCH'; payload: Partial<AppStateType['search']> }
  | { type: 'RESET' };

function appReducer(state: AppStateType, action: Action): AppStateType {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_TOKEN':
      return { ...state, token: action.payload };
    case 'SET_WALLET':
      return { ...state, wallet: action.payload };
    case 'SET_SEARCH':
      return { ...state, search: { ...state.search, ...action.payload } };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppStateType;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => undefined });

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return React.createElement(AppContext.Provider, { value: { state, dispatch } }, children);
}

export function useAppState() {
  return useContext(AppContext);
}
