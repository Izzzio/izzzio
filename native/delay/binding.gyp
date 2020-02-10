{
	'targets': [
		{
			'target_name': 'delay-native',
			'include_dirs': [
				'<!(node -e "require(\'nan\')")',
				'<!(node -e "require(\'isolated-vm/include\')")',
			],
			'sources': [
				'delay.cc',
			],
		},
	],
}
