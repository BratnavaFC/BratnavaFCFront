import { useState, useCallback } from 'react';
import { X, Download, Copy, Check, Loader2, Image as ImageIcon } from 'lucide-react';
import ModalBackdrop from './ModalBackdrop';
import { MatchCardApi } from '../../api/endpoints';
import type { PlayerInMatchDto } from '../../domains/matches/matchTypes';

/* ─── Props ───────────────────────────────────────────────────────────────── */

export type CardTemplate = 'match_preview' | 'match_result';

export interface MatchShareCardProps {
    groupId: string;
    template: CardTemplate;

    teamAName: string;
    teamAColorHex: string;
    teamAPlayers: PlayerInMatchDto[];

    teamBName: string;
    teamBColorHex: string;
    teamBPlayers: PlayerInMatchDto[];

    matchPlayedAt: string;

    // Só para match_result
    teamAGoals?: number;
    teamBGoals?: number;
    mvpName?: string;
    winnerTeamName?: string;

    onClose: () => void;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function MatchShareCardModal({
    groupId, template,
    teamAName, teamAColorHex, teamAPlayers,
    teamBName, teamBColorHex, teamBPlayers,
    matchPlayedAt,
    teamAGoals, teamBGoals, mvpName, winnerTeamName,
    onClose,
}: MatchShareCardProps) {
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const isResult = template === 'match_result';

    // ── Gerar imagem via API ──
    const handleGenerate = useCallback(async () => {
        setLoading(true);
        setError(null);
        setImageBase64(null);

        try {
            const res = await MatchCardApi.generate(groupId, {
                template,
                teamAName,
                teamAColorHex,
                teamAPlayers: teamAPlayers.map(p => ({
                    name: p.playerName,
                    isGoalkeeper: p.isGoalkeeper,
                })),
                teamBName,
                teamBColorHex,
                teamBPlayers: teamBPlayers.map(p => ({
                    name: p.playerName,
                    isGoalkeeper: p.isGoalkeeper,
                })),
                playedAt: matchPlayedAt || undefined,
                teamAGoals: isResult ? teamAGoals : undefined,
                teamBGoals: isResult ? teamBGoals : undefined,
                mvpName: isResult ? mvpName : undefined,
                winnerTeamName: isResult ? winnerTeamName : undefined,
            });

            const data = res.data;
            if (data?.success && data.data) {
                setImageBase64(data.data);
            } else {
                setError((data as any)?.error || 'Erro ao gerar imagem.');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.error || err?.message || 'Erro de rede.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [groupId, template, teamAName, teamAColorHex, teamAPlayers, teamBName, teamBColorHex, teamBPlayers, matchPlayedAt, teamAGoals, teamBGoals, mvpName, winnerTeamName, isResult]);

    // ── Copy to clipboard ──
    async function handleCopy() {
        if (!imageBase64) return;
        try {
            const blob = base64ToBlob(imageBase64, 'image/png');
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            handleDownload();
        }
    }

    // ── Download ──
    function handleDownload() {
        if (!imageBase64) return;
        const a = document.createElement('a');
        a.download = `bratnava-${teamAName}-vs-${teamBName}-${template}.png`
            .toLowerCase().replace(/\s+/g, '-');
        a.href = `data:image/png;base64,${imageBase64}`;
        a.click();
    }

    return (
        <ModalBackdrop onClose={onClose}>
            <div className="w-full sm:max-w-md max-h-[92vh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b dark:border-slate-700 flex items-center justify-between shrink-0">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {isResult ? 'Card Fim de Jogo' : 'Card da Partida'}
                    </h2>
                    <button onClick={onClose} type="button" className="h-8 w-8 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500">
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center gap-4 bg-slate-50 dark:bg-slate-900 min-h-0">

                    {/* Info resumo */}
                    <div className="w-full rounded-xl bg-white dark:bg-slate-800 p-4 border dark:border-slate-700 space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wide">
                            <ImageIcon size={14} />
                            {isResult ? 'Dados do resultado' : 'Dados da partida'}
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ backgroundColor: teamAColorHex }} />
                            <span className="font-semibold text-slate-800 dark:text-white">{teamAName}</span>
                            <span className="text-slate-400">({teamAPlayers.length} jogadores)</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ backgroundColor: teamBColorHex }} />
                            <span className="font-semibold text-slate-800 dark:text-white">{teamBName}</span>
                            <span className="text-slate-400">({teamBPlayers.length} jogadores)</span>
                        </div>

                        {isResult && teamAGoals != null && teamBGoals != null && (
                            <div className="text-center font-bold text-lg text-slate-800 dark:text-white pt-1">
                                {teamAGoals} x {teamBGoals}
                                {mvpName && <span className="block text-sm font-normal text-amber-500">MVP: {mvpName}</span>}
                            </div>
                        )}
                    </div>

                    {/* Generate button */}
                    {!imageBase64 && !loading && (
                        <button
                            type="button"
                            onClick={handleGenerate}
                            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                        >
                            <ImageIcon size={16} />
                            Gerar imagem com IA
                        </button>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="flex flex-col items-center gap-3 py-10">
                            <Loader2 size={32} className="animate-spin text-indigo-500" />
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                Gerando imagem com ChatGPT...
                            </span>
                            <span className="text-xs text-slate-400">Isso pode levar até 30 segundos</span>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="w-full rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
                            <p className="font-medium">Erro ao gerar imagem</p>
                            <p className="text-xs mt-1 opacity-80">{error}</p>
                            <button
                                type="button"
                                onClick={handleGenerate}
                                className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400 underline"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    )}

                    {/* Generated image */}
                    {imageBase64 && (
                        <>
                            <img
                                src={`data:image/png;base64,${imageBase64}`}
                                alt="Match card"
                                className="w-full rounded-lg shadow-xl"
                            />
                            <button
                                type="button"
                                onClick={handleGenerate}
                                className="text-xs text-indigo-500 hover:text-indigo-600 font-medium underline"
                            >
                                Gerar novamente
                            </button>
                        </>
                    )}
                </div>

                {/* Actions */}
                {imageBase64 && (
                    <div className="px-5 py-4 border-t dark:border-slate-700 flex gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
                        >
                            <Download size={14} />
                            Baixar
                        </button>
                    </div>
                )}
            </div>
        </ModalBackdrop>
    );
}

/* ─── Utils ───────────────────────────────────────────────────────────────── */

function base64ToBlob(base64: string, type: string): Blob {
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
}
