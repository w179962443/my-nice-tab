import { Space, Typography } from 'antd';
import { useIntlUtls } from '../hooks/global';
import usePersonalRelease from '../hooks/usePersonalRelease';

export default function PersonalReleaseNotice({
  className = '',
}: {
  className?: string;
}) {
  const release = usePersonalRelease();
  const { $fmt } = useIntlUtls();
  if (!release) return null;

  return (
    <Space className={`personal-release-notice ${className}`} size="small" wrap>
      <Typography.Text type="warning">
        {$fmt({
          id: 'common.personalRelease.available',
          values: { build: release.build },
        })}
      </Typography.Text>
      <a href={release.downloadUrl} target="_blank" rel="noopener noreferrer">
        {$fmt('common.personalRelease.download')}
      </a>
    </Space>
  );
}
