/**
 * ai-chatbot-fullpage / index.js
 *
 * Entry point — Web Component per Liferay DXP.
 * Si monta direttamente nell'elemento della pagina (non overlay).
 * Progettato per occupare l'intera area del portlet/pagina.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import './assets/chatbot-fullpage.css';
import ChatbotFullpage from './assets/components/ChatbotFullpage';

const ELEMENT_NAME = 'ai-chatbot-fullpage';

class AiChatbotFullpageWebComponent extends HTMLElement {
    connectedCallback() {
        if (!this._rendered) {
            ReactDOM.render(
                React.createElement(ChatbotFullpage),
                this
            );
            this._rendered = true;
        }
    }

    disconnectedCallback() {
        ReactDOM.unmountComponentAtNode(this);
        this._rendered = false;
    }
}

if (!customElements.get(ELEMENT_NAME)) {
    customElements.define(ELEMENT_NAME, AiChatbotFullpageWebComponent);
}
