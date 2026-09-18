===================================================================================================================

As 34 skills abaixo estão instaladas neste repo em `.claude/skills/` — commitadas, por isso
funcionam em qualquer máquina que faça clone, sem voltar a ir buscá-las.

===================================================================================================================

GENERAL PURPOSE



\-[Stop Slop](https://github.com/hardikpandya/stop-slop) : Deixa de escrever bullshit

\-



\-------------------------------------------------------------------------------------------------------------------

WEB DESIGN



\-[UI Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) : Fugir do comum. Base de dados local pesquisável — 84 estilos, 192 paletas, 74 pares de fontes

\-[Front-End Geral](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) : Front-End geral mais guiado para o pedido e não reutilizar da internet

\-[Shadcn](https://github.com/shadcn-ui/ui/blob/main/skills/shadcn/SKILL.md) : Componentes fora do comum

\-[Animações](https://github.com/greensock/gsap-skills) : Animações não básicas. São 9 skills separadas (core, timeline, scrolltrigger, react, plugins, utils, performance, frameworks)

\-[Impeccable](https://impeccable.style) : A maior das instaladas. Auditoria e polimento de interfaces com detector próprio que corre em hook a cada edição de UI — hierarquia, contraste, tipografia, espaçamento, anti-padrões

\-[Taste](https://github.com/Leonxlnx/taste-skill) : Anti-slop para landing pages e portfolios. Audita primeiro quando é redesign

\-[Redesign](.claude/skills/redesign-skill/SKILL.md) : Pega num site existente e sobe-o a qualidade premium sem partir funcionalidade

\-[Minimalista](.claude/skills/minimalist-skill/SKILL.md) : Editorial, monocromático quente, bento flat. Sem gradientes nem sombras pesadas

\-[Brandkit](.claude/skills/brandkit/SKILL.md) : Manuais de marca, sistemas de logo, decks de identidade



\-------------------------------------------------------------------------------------------------------------------

DASHBOARDS



\-[Dashboard Geral](https://awesomeskill.ai/skill/anthropics-knowledge-work-plugins-build-dashboard) : dashboards gerais e componentes

que dão para ser inspiradas e reutilizadas

\-[Animações](https://github.com/greensock/gsap-skills) : Animações não básicas

\-[Impeccable](https://impeccable.style) : Hierarquia visual e carga cognitiva — o que separa um dashboard com 15 cartões iguais de um que responde à pergunta



\-------------------------------------------------------------------------------------------------------------------

MOBILE



\-[UI Geral Mobile Apps](https://github.com/hamen/material-3-skill) : Design mobile para apps ios e android

\-[Impeccable](https://impeccable.style) : Tem referências próprias para iOS e Android, e modo "adapt" para passar web → nativo

\-[UI Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) : Cobre SwiftUI, React Native, Flutter e Jetpack Compose



\-------------------------------------------------------------------------------------------------------------------

FINANCES



\-

\-



\-------------------------------------------------------------------------------------------------------------------

AGENTES — CONTEXTO E MEMÓRIA

Todas de [agent-skills-for-context-engineering](https://github.com/muratcankoylan/agent-skills-for-context-engineering)



\-[Context Fundamentals](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/context-fundamentals) : Os conceitos de base — o que é a janela de contexto, a curva de atenção em U, porque é que qualidade bate quantidade

\-[Context Optimization](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/context-optimization) : Reduzir custo em tokens sem perder qualidade de resposta

\-[Context Compression](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/context-compression) : Sumarização e handoff de sessões longas sem perder decisões e ficheiros

\-[Context Degradation](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/context-degradation) : Diagnosticar quando o agente piora — contexto envenenado, informação perdida no meio, instruções em conflito

\-[Filesystem Context](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/filesystem-context) : Usar ficheiros como memória — scratchpads, descarregar output de ferramentas, handoff entre agentes

\-[Memory Systems](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/memory-systems) : Memória semântica persistente entre sessões

\-[Latent Briefing](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/latent-briefing) : Partilhar memória entre agentes sem sumarizar, para não explodir em tokens



\-------------------------------------------------------------------------------------------------------------------

AGENTES — ARQUITETURA E QUALIDADE

Mesma origem



\-[Multi-Agent Patterns](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/multi-agent-patterns) : Quando vale mesmo a pena ter vários agentes, e como coordená-los

\-[Harness Engineering](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/harness-engineering) : Andaimes para agentes autónomos — logs duráveis, rollback, onde o humano aprova

\-[Hosted Agents](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/hosted-agents) : Agentes em sandbox remota, sessões persistentes

\-[Self-Improvement Loops](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/self-improvement-loops) : Quando o próprio sistema é o alvo da optimização

\-[Long-Horizon Prompting](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/long-horizon-prompting) : Escrever o prompt de arranque de um agente que vai correr muito tempo sozinho

\-[Tool Design](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/tool-design) : Desenhar ferramentas e MCP que um agente consiga mesmo usar

\-[Project Development](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/project-development) : Decisões ao nível do projeto — vale a pena um LLM aqui, quanto custa, como estruturar

\-[Evaluation](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/evaluation) : Suites de regressão e portões de qualidade para pipelines de agentes

\-[Advanced Evaluation](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/advanced-evaluation) : LLM-as-judge, comparação par-a-par, calibrar rubricas, mitigar enviesamento do avaliador

\-[BDI Mental States](https://github.com/muratcankoylan/agent-skills-for-context-engineering/tree/main/skills/bdi-mental-states) : Modelar crenças/desejos/intenções de agentes. Mais teórico



\-------------------------------------------------------------------------------------------------------------------
