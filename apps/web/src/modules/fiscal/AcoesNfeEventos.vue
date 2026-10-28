<script setup lang="ts">
/**
 * ECOL-28b — Carta de correção (CC-e) e envio de DANFE/XML por e-mail para NF-e autorizada.
 * Sem token Focus, o backend registra eventos simulados (mock) — nada vai à Sefaz nem ao e-mail real.
 */
import { computed, ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { Mail, FilePenLine } from 'lucide-vue-next';
import { PermissaoComercial } from '@arcco/contratos';
import Button from '@/components/ui/Button.vue';
import Label from '@/components/ui/Label.vue';
import Input from '@/components/ui/Input.vue';
import Textarea from '@/components/ui/Textarea.vue';
import Badge from '@/components/ui/Badge.vue';
import { servicoNotasFiscais, type EventoNotaFiscalResumo } from '@/services';
import { useNotificacao } from '@/composables/useNotificacao';
import { formatarData } from '@/composables/formatadores';
import { useAutenticacaoStore } from '@/stores/autenticacao';

const props = defineProps<{
  notaId: string;
  status: string;
  /** E-mail do cliente (pré-preenche o campo). */
  emailPadrao?: string | null;
  eventos?: EventoNotaFiscalResumo[];
  /** Backend sem token → eventos simulados. */
  simulado?: boolean;
}>();
const emit = defineEmits<{ (e: 'atualizado'): void }>();

const auth = useAutenticacaoStore();
const queryClient = useQueryClient();
const { notificarErro, sucesso } = useNotificacao();

const autorizada = computed(() => props.status === 'AUTORIZADA');
const podeCce = computed(() => auth.temPermissaoComercial(PermissaoComercial.CARTA_CORRECAO));
const podeEmail = computed(() => auth.temPermissaoComercial(PermissaoComercial.EMITIR_NF));

const painel = ref<'cce' | 'email' | null>(null);
const correcao = ref('');
const confirmaCce = ref(false);
const enviandoCce = ref(false);
const emailsTexto = ref('');
const enviandoEmail = ref(false);

const tamanhoCorrecao = computed(() => correcao.value.trim().length);
const cceValida = computed(
  () => tamanhoCorrecao.value >= 15 && tamanhoCorrecao.value <= 1000 && confirmaCce.value,
);
const listaEmails = computed(() =>
  emailsTexto.value
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean),
);
const emailsValidos = computed(
  () =>
    listaEmails.value.length >= 1 &&
    listaEmails.value.length <= 10 &&
    listaEmails.value.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
);

function abrir(qual: 'cce' | 'email') {
  painel.value = painel.value === qual ? null : qual;
  if (qual === 'email' && !emailsTexto.value && props.emailPadrao) {
    emailsTexto.value = props.emailPadrao;
  }
}

function aposAcao() {
  void queryClient.invalidateQueries({ queryKey: ['fiscal'] });
  emit('atualizado');
}

async function enviarCce() {
  if (!cceValida.value) return;
  enviandoCce.value = true;
  try {
    const r = await servicoNotasFiscais.cartaCorrecao(props.notaId, {
      correcao: correcao.value.trim(),
    });
    sucesso(
      r.mock
        ? `CC-e simulada (sem token Focus) · seq. ${r.evento.numeroSequencia ?? '—'}`
        : `CC-e autorizada · seq. ${r.evento.numeroSequencia ?? '—'}`,
    );
    correcao.value = '';
    confirmaCce.value = false;
    painel.value = null;
    aposAcao();
  } catch (e) {
    notificarErro(e);
  } finally {
    enviandoCce.value = false;
  }
}

async function enviarEmail() {
  if (!emailsValidos.value) return;
  enviandoEmail.value = true;
  try {
    const r = await servicoNotasFiscais.enviarEmail(props.notaId, { emails: listaEmails.value });
    sucesso(
      r.envioReal
        ? 'Envio de e-mail agendado na Focus'
        : 'E-mail simulado (sem token Focus) — nada foi enviado',
    );
    painel.value = null;
    aposAcao();
  } catch (e) {
    notificarErro(e);
  } finally {
    enviandoEmail.value = false;
  }
}

function rotuloEvento(ev: EventoNotaFiscalResumo) {
  if (ev.tipo === 'CCE') return `CC-e${ev.numeroSequencia ? ` #${ev.numeroSequencia}` : ''}`;
  return 'E-mail DANFE/XML';
}

function varianteEvento(status: string) {
  if (status === 'AUTORIZADO' || status === 'AGENDADO') return 'sucesso';
  if (status === 'REJEITADO' || status === 'ERRO') return 'erro';
  return 'neutro';
}
</script>

<template>
  <div class="space-y-2 border-t border-borda pt-2 text-sm" data-testid="acoes-nfe-eventos">
    <p class="text-xs font-semibold text-texto-secundario">Carta de correção e e-mail</p>

    <p v-if="!autorizada" class="text-xs text-texto-secundario">
      Disponível apenas para NF-e autorizada.
    </p>
    <template v-else>
      <p v-if="simulado" class="text-[11px] text-alerta">
        Sem token Focus: CC-e e e-mail são simulados e não têm efeito na Sefaz nem no e-mail real.
      </p>
      <div class="flex flex-wrap gap-2">
        <Button
          v-if="podeCce"
          variante="contorno"
          tamanho="sm"
          data-testid="btn-cce"
          @click="abrir('cce')"
        >
          <FilePenLine class="size-4" /> Carta de correção
        </Button>
        <Button
          v-if="podeEmail"
          variante="contorno"
          tamanho="sm"
          data-testid="btn-email"
          @click="abrir('email')"
        >
          <Mail class="size-4" /> Enviar e-mail
        </Button>
        <p v-if="!podeCce && !podeEmail" class="text-xs text-texto-secundario">
          Sem permissão CARTA_CORRECAO / EMITIR_NF.
        </p>
      </div>

      <div
        v-if="painel === 'cce'"
        class="space-y-2 rounded border border-borda bg-superficie p-2"
      >
        <Label obrigatorio>Texto da correção (15 a 1000 caracteres)</Label>
        <Textarea v-model="correcao" :rows="4" maxlength="1000" />
        <p class="text-[11px] text-texto-secundario">
          {{ tamanhoCorrecao }}/1000 · Não corrige valores, impostos, dados cadastrais do
          emitente/destinatário (CNPJ/IE) nem data de emissão.
        </p>
        <label class="flex items-center gap-2 text-xs">
          <input v-model="confirmaCce" type="checkbox" />
          Confirmo o envio desta carta de correção
        </label>
        <Button tamanho="sm" :carregando="enviandoCce" :disabled="!cceValida" @click="enviarCce">
          Enviar CC-e
        </Button>
      </div>

      <div
        v-if="painel === 'email'"
        class="space-y-2 rounded border border-borda bg-superficie p-2"
      >
        <Label obrigatorio>Destinatários (até 10, separados por vírgula)</Label>
        <Input v-model="emailsTexto" placeholder="cliente@empresa.com" />
        <p v-if="emailsTexto && !emailsValidos" class="text-[11px] text-erro">
          Informe de 1 a 10 e-mails válidos.
        </p>
        <Button
          tamanho="sm"
          :carregando="enviandoEmail"
          :disabled="!emailsValidos"
          @click="enviarEmail"
        >
          Enviar DANFE/XML
        </Button>
      </div>
    </template>

    <ul v-if="eventos?.length" class="space-y-1 text-xs text-texto-secundario">
      <li v-for="ev in eventos" :key="ev.id" class="flex flex-wrap items-center gap-1.5">
        <Badge :variante="varianteEvento(ev.status)">{{ ev.status }}</Badge>
        <span class="text-texto">{{ rotuloEvento(ev) }}</span>
        <span v-if="ev.mock">(simulação)</span>
        <span>· {{ formatarData(ev.criadoEm) }}</span>
        <span v-if="ev.emails?.length">· {{ ev.emails.join(', ') }}</span>
        <span v-if="ev.texto" class="w-full truncate">{{ ev.texto }}</span>
      </li>
    </ul>
  </div>
</template>
