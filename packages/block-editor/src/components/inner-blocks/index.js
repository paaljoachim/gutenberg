/**
 * External dependencies
 */
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { useViewportMatch } from '@wordpress/compose';
import { forwardRef, useRef } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { getBlockType, withBlockContentContext } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import ButtonBlockAppender from './button-block-appender';
import DefaultBlockAppender from './default-block-appender';
import useNestedSettingsUpdate from './use-nested-settings-update';
import useInnerBlockTemplateSync from './use-inner-block-template-sync';
import getBlockContext from './get-block-context';

/**
 * Internal dependencies
 */
import BlockList, { BlockListItems } from '../block-list';
import { BlockContextProvider } from '../block-context';
import { useBlockEditContext } from '../block-edit/context';
import useBlockSync from '../provider/use-block-sync';

/**
 * InnerBlocks is a component which allows a single block to have multiple blocks
 * as children. The UncontrolledInnerBlocks component is used whenever the inner
 * blocks are not controlled by another entity. In other words, it is normally
 * used for inner blocks in the post editor
 *
 * @param {Object} props The component props.
 */
function UncontrolledInnerBlocks( props ) {
	const {
		clientId,
		allowedBlocks,
		template,
		templateLock,
		forwardedRef,
		templateInsertUpdatesSelection,
		__experimentalCaptureToolbars: captureToolbars,
		orientation,
	} = props;

	const isSmallScreen = useViewportMatch( 'medium', '<' );

	const { hasOverlay, block, enableClickThrough } = useSelect( ( select ) => {
		const {
			getBlock,
			isBlockSelected,
			hasSelectedInnerBlock,
			isNavigationMode,
		} = select( 'core/block-editor' );
		const theBlock = getBlock( clientId );
		return {
			block: theBlock,
			hasOverlay:
				theBlock.name !== 'core/template' &&
				! isBlockSelected( clientId ) &&
				! hasSelectedInnerBlock( clientId, true ),
			enableClickThrough: isNavigationMode() || isSmallScreen,
		};
	} );

	useNestedSettingsUpdate(
		clientId,
		allowedBlocks,
		templateLock,
		captureToolbars,
		orientation
	);

	useInnerBlockTemplateSync(
		clientId,
		template,
		templateLock,
		templateInsertUpdatesSelection
	);

	const classes = classnames( {
		'has-overlay': enableClickThrough && hasOverlay,
		'is-capturing-toolbar': captureToolbars,
	} );

	let blockList = (
		<BlockList
			{ ...props }
			ref={ forwardedRef }
			rootClientId={ clientId }
			className={ classes }
		/>
	);

	// Wrap context provider if (and only if) block has context to provide.
	const blockType = getBlockType( block.name );
	if ( blockType && blockType.providesContext ) {
		const context = getBlockContext( block.attributes, blockType );

		blockList = (
			<BlockContextProvider value={ context }>
				{ blockList }
			</BlockContextProvider>
		);
	}

	if ( props.__experimentalTagName ) {
		return blockList;
	}

	return <div className="block-editor-inner-blocks">{ blockList }</div>;
}

/**
 * The controlled inner blocks component wraps the uncontrolled inner blocks
 * component with the blockSync hook. This keeps the innerBlocks of the block in
 * the block-editor store in sync with the blocks of the controlling entity. An
 * example of an inner block controller is a template part block, which provides
 * its own blocks from the template part entity data source.
 *
 * @param {Object} props The component props.
 */
function ControlledInnerBlocks( props ) {
	useBlockSync( props );
	return <UncontrolledInnerBlocks { ...props } />;
}

/**
 * Wrapped InnerBlocks component which detects whether to use the controlled or
 * uncontrolled variations of the InnerBlocks component. This is the component
 * which should be used throughout the application.
 */
const ForwardedInnerBlocks = forwardRef( ( props, ref ) => {
	const { clientId } = useBlockEditContext();
	const fallbackRef = useRef();

	const allProps = {
		clientId,
		forwardedRef: ref || fallbackRef,
		...props,
	};

	// Detects if the InnerBlocks should be controlled by an incoming value.
	if ( props.value && props.onChange ) {
		return <ControlledInnerBlocks { ...allProps } />;
	}
	return <UncontrolledInnerBlocks { ...allProps } />;
} );

function Uncontrolled( {
	clientId,
	allowedBlocks,
	template,
	templateLock,
	wrapperRef,
	templateInsertUpdatesSelection,
	__experimentalCaptureToolbars: captureToolbars,
	__experimentalAppenderTagName,
	renderAppender,
	orientation,
} ) {
	useNestedSettingsUpdate(
		clientId,
		allowedBlocks,
		templateLock,
		captureToolbars,
		orientation
	);

	useInnerBlockTemplateSync(
		clientId,
		template,
		templateLock,
		templateInsertUpdatesSelection
	);

	const blockListItems = (
		<BlockListItems
			rootClientId={ clientId }
			renderAppender={ renderAppender }
			__experimentalAppenderTagName={ __experimentalAppenderTagName }
			wrapperRef={ wrapperRef }
		/>
	);

	const block = useSelect(
		( select ) => select( 'core/block-editor' ).getBlock( clientId ),
		[ clientId ]
	);

	if ( ! block ) {
		return blockListItems;
	}

	// Wrap context provider if (and only if) block has context to provide.
	const blockType = getBlockType( block.name );

	if ( ! blockType || ! blockType.providesContext ) {
		return blockListItems;
	}

	const context = getBlockContext( block.attributes, blockType );

	return (
		<BlockContextProvider value={ context }>
			{ blockListItems }
		</BlockContextProvider>
	);
}

function InnerBlocks( props ) {
	const { clientId } = useBlockEditContext();
	const Component =
		props.value && props.onChange ? ControlledInnerBlocks : Uncontrolled;

	return <Component { ...props } clientId={ clientId } />;
}

export function useInnerBlocksProps( props, options ) {
	const fallbackRef = useRef();
	const { clientId } = useBlockEditContext();
	const isSmallScreen = useViewportMatch( 'medium', '<' );
	const hasOverlay = useSelect(
		( select ) => {
			const {
				getBlockName,
				isBlockSelected,
				hasSelectedInnerBlock,
				isNavigationMode,
			} = select( 'core/block-editor' );
			return (
				getBlockName( clientId ) !== 'core/template' &&
				! isBlockSelected( clientId ) &&
				! hasSelectedInnerBlock( clientId, true ) &&
				( isNavigationMode() || isSmallScreen )
			);
		},
		[ clientId, isSmallScreen ]
	);

	const ref = props.ref || fallbackRef;

	return {
		...props,
		ref,
		className: classnames(
			props.className,
			'block-editor-block-list__layout',
			{
				'has-overlay': hasOverlay,
			}
		),
		children: <InnerBlocks { ...options } wrapperRef={ ref } />,
	};
}

// Expose default appender placeholders as components.
ForwardedInnerBlocks.DefaultBlockAppender = DefaultBlockAppender;
ForwardedInnerBlocks.ButtonBlockAppender = ButtonBlockAppender;

ForwardedInnerBlocks.Content = withBlockContentContext(
	( { BlockContent } ) => <BlockContent />
);

/**
 * @see https://github.com/WordPress/gutenberg/blob/master/packages/block-editor/src/components/inner-blocks/README.md
 */
export default ForwardedInnerBlocks;
