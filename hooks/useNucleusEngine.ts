
/**
 * 廃止済み: このモノリシックなフックは useNucleusCoordinator に置き換えられました。
 * 予期せぬ参照によるバグを防ぐため、エラーをスローするスタブとして保持します。
 */
export const useNucleusEngine = () => {
    throw new Error("useNucleusEngine is deprecated and has been decommissioned. Please use useNucleusCoordinator instead.");
};
