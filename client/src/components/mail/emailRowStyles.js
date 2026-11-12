import { styled, Box } from '@mui/material';
import { motion } from 'framer-motion';

export const EmailRow = styled(Box)`
  position: relative;
  padding: 12px 20px;
  background: #ffffff;
  display: flex;
  align-items: center;
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s ease-in-out;

  &:hover {
    background: #f8fafc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
`;

export const CategoryPill = styled(Box)`
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 9999px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  white-space: nowrap;
  user-select: none;
  background-color: ${(props) => `${props.color}15`};
  color: ${(props) => props.color};
  border: 1px solid ${(props) => `${props.color}30`};
`;

export const AttachmentChip = styled(Box)`
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: #f1f5f9;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  color: #475569;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid #e2e8f0;

  & > svg {
    font-size: 14px;
    color: #64748b;
  }
`;

export const SummaryDrawer = styled(motion.div)`
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px 20px;
  margin: 8px 20px 14px 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  font-family: 'Inter', sans-serif;
  color: #1e293b;
  font-size: 13.5px;
  line-height: 1.6;
`;
