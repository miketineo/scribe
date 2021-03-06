define([
  'immutable'
], function (Immutable) {

  /**
   * Chrome and Firefox: Upon pressing backspace inside of a P, the
   * browser deletes the paragraph element, leaving the caret (and any
   * content) outside of any P.
   *
   * Firefox: Erasing across multiple paragraphs, or outside of a
   * whole paragraph (e.g. by ‘Select All’) will leave content outside
   * of any P.
   *
   * Entering a new line in a pristine state state will insert
   * `<div>`s (in Chrome) or `<br>`s (in Firefox) where previously we
   * had `<p>`'s. This patches the behaviour of delete/backspace so
   * that we do not end up in a pristine state.
   */

  'use strict';

  return function () {
    return function (scribe) {
      var nodeHelpers = scribe.node;

      /**
       * Wrap consecutive inline elements and text nodes in a P element.
       */
      function wrapChildNodes(parentNode) {
        var index = 0;
        Immutable.List(parentNode.childNodes)
          .filter(function(node) {
            return node.nodeType === Node.TEXT_NODE || !nodeHelpers.isBlockElement(node);
          })
          .groupBy(function(node, key, list) {
            return key === 0 || node.previousSibling === list.get(key - 1) ?
              index :
              index += 1;
          })
          .forEach(function(nodeGroup) {
            nodeHelpers.wrap(nodeGroup.toArray(), document.createElement('p'));
          });
      }

      // Traverse the tree, wrapping child nodes as we go.
      function traverse(parentNode) {
        var i = 0, node;

        while (node = parentNode.children[i++]) {
          if (node.tagName === 'BLOCKQUOTE') {
            wrapChildNodes(node);
          }
        }
      }

      scribe.registerHTMLFormatter('normalize', function (html) {
        /**
         * Ensure P mode.
         *
         * Wrap any orphan text nodes in a P element.
         */
        // TODO: This should be configurable and also correct markup such as
        // `<ul>1</ul>` to <ul><li>2</li></ul>`. See skipped tests.
        // TODO: This should probably be a part of HTML Janitor, or some other
        // formatter.
        var bin = document.createElement('div');
        bin.innerHTML = html;

        /**
         * Remove empty <p></p> elements.
         *
         * Some DOM transformations on the editor DOM produce empty <p></p> elements
         * as a result of the internal browser normalization happening e.g. after
         * inserting a P element inside of another P element. These elements need to
         * be removed as they do not produce visible layout. Because of the
         * ensure-selectable-containers normalization though they suddenly get a <br>
         * element inside which triggers layout and rendering resulting in empty lines
         * which is something undesired.
         */

        [].forEach.call(bin.querySelectorAll('p'), function(p) {
          if (!p.firstChild) {
            p.parentNode.removeChild(p);  
          }
        });

        wrapChildNodes(bin);
        traverse(bin);

        return bin.innerHTML;
      });

    };
  };

});
